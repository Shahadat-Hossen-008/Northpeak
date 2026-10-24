import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { concurrencyTestBarriers } from "./team.js";

/**
 * Reconciles task and subtask assignments against each owning project's team.
 * Project, task, and subtask flows plus server startup call these functions.
 * This service owns database repair only and never handles HTTP requests.
 */
export interface ReconcileResult {
  projects: number;
  tasks: number;
  subtasks: number;
}

/**
 * Clears invalid assignments on open tasks and subtasks, returning modified counts.
 * Project, task, and subtask workflows and the periodic server job may call this.
 * Database errors propagate without an HTTP status; the barrier throws "Simulated failure during assignment reconciliation".
 */
export async function reconcileAssignments(
  options: { projectId?: mongoose.Types.ObjectId | string } = {},
): Promise<ReconcileResult> {
  if (concurrencyTestBarriers.simulateReconcileFailure) {
    throw new Error("Simulated failure during assignment reconciliation");
  }

  const filter = options.projectId ? { _id: options.projectId } : {};
  const result: ReconcileResult = { projects: 0, tasks: 0, subtasks: 0 };

  // 1. Load each project's current team membership.
  for await (const project of Project.find(filter).select("_id team").cursor()) {
    result.projects += 1;
    const team = (project.team || []).map((id) => id);

    // 2. Repair assignments for open work in this project.
    await reconcileProjectAssignments(project._id, team, result);
  }

  // 3. Return the number of repaired records.
  return result;
}

/** Repairs invalid task and subtask assignments for one project. */
async function reconcileProjectAssignments(
  projectId: mongoose.Types.ObjectId,
  team: mongoose.Types.ObjectId[],
  result: ReconcileResult,
): Promise<void> {
  const tasks = await Task.updateMany(
    {
      project: projectId,
      isCompleted: false,
      assignedDeveloper: { $ne: null, $nin: team },
    },
    { $set: { assignedDeveloper: null, assignedBy: null } },
  );
  result.tasks += tasks.modifiedCount || 0;

  const taskIds = await Task.find({ project: projectId }).distinct("_id");
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

/**
 * Retries reconciliation and logs "Assignment reconciliation failed; periodic reconciler will retry" on exhaustion.
 * Mutation workflows and the periodic job may call this; database writes happen in each attempt.
 */
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
 * Starts immediate and periodic reconciliation for server startup, returning an unref'd timer or null.
 * Failures are contained by the safe wrapper; non-positive intervals disable the schedule.
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
