import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { concurrencyTestBarriers } from "./team.js";

export interface ReconcileResult {
  projects: number;
  tasks: number;
  subtasks: number;
}

/**
 * Restores the invariant: an OPEN task/subtask is never assigned to a developer who is not in
 * the owning project's team.
 *
 * - Source of truth is `project.team`; the predicate is derived from it (not from a "removed IDs"
 *   list), so the sweep is idempotent and also repairs state left behind by crashes or failed
 *   compensations.
 * - Completed tasks/subtasks are never touched, preserving completion attribution.
 * - Safe to run at any time and concurrently with requests: each write is a single updateMany whose
 *   filter re-evaluates membership against the team snapshot read just before it.
 */
export async function reconcileAssignments(
  options: { projectId?: mongoose.Types.ObjectId | string } = {},
): Promise<ReconcileResult> {
  if (concurrencyTestBarriers.simulateReconcileFailure) {
    throw new Error("Simulated failure during assignment reconciliation");
  }

  const filter = options.projectId ? { _id: options.projectId } : {};
  const result: ReconcileResult = { projects: 0, tasks: 0, subtasks: 0 };

  for await (const project of Project.find(filter).select("_id team").cursor()) {
    result.projects += 1;
    const team = (project.team || []).map((id) => id);

    const tasks = await Task.updateMany(
      {
        project: project._id,
        isCompleted: false,
        assignedDeveloper: { $ne: null, $nin: team },
      },
      { $set: { assignedDeveloper: null, assignedBy: null } },
    );
    result.tasks += tasks.modifiedCount || 0;

    const taskIds = await Task.find({ project: project._id }).distinct("_id");
    if (taskIds.length > 0) {
      const subtasks = await Subtask.updateMany(
        {
          task: { $in: taskIds },
          isCompleted: false,
          assignedDeveloper: { $ne: null, $nin: team },
        },
        { $set: { assignedDeveloper: null } },
      );
      result.subtasks += subtasks.modifiedCount || 0;
    }
  }

  return result;
}

/** Runs {@link reconcileAssignments} with bounded retries; never throws. */
export async function reconcileAssignmentsSafely(
  options: { projectId?: mongoose.Types.ObjectId | string } = {},
  attempts = 3,
): Promise<{ ok: boolean; result?: ReconcileResult }> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return { ok: true, result: await reconcileAssignments(options) };
    } catch (err) {
      lastError = err;
    }
  }
  console.error(
    JSON.stringify({
      level: "error",
      message: "Assignment reconciliation failed; periodic reconciler will retry",
      projectId: options.projectId ? String(options.projectId) : undefined,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    }),
  );
  return { ok: false };
}

/**
 * Starts the periodic safety-net reconciler. Disabled in tests and when the interval is 0.
 * The timer is unref'd so it never blocks graceful shutdown.
 */
export function startAssignmentReconciler(intervalMs: number): NodeJS.Timeout | null {
  if (!intervalMs || intervalMs <= 0) return null;
  void reconcileAssignmentsSafely();
  const timer = setInterval(() => {
    void reconcileAssignmentsSafely();
  }, intervalMs);
  timer.unref();
  return timer;
}
