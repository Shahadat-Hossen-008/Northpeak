// Project team update transaction and standalone fallback workflows.
// Called by the Project update workflow.
// Team barriers, rollback, reconciliation, and write order stay in this module.

import { config } from "../../config/env.js";
import mongoose from "mongoose";
import { AppError } from "../../middleware/error.js";
import { reconcileAssignmentsSafely } from "../reconcile.service.js";
import { concurrencyTestBarriers } from "../team.js";
import { syncRemovedTeamTaskAssignments, validateTeamDeveloperIds } from "./project.team.js";

/**
 * Persists a validated project team change.
 * Who may call it: the Project update workflow. Side effects: project, task and subtask writes; assignment reconciliation.
 * Errors: 400 ("Team must be an array of developer IDs", "Invalid developer ID: <id>",
 * "All team members must be registered developers", or fallback "Invalid team developer IDs"
 * if a failed validation has no error message);
 * 409 ("Project was modified by another concurrent request. Please reload and try again.");
 * 503 ("Project team update is temporarily unavailable. Please try again later.").
 */
export async function updateProjectTeam(
  project: any,
  team: any[],
): Promise<{ unassignedTasksCount: number; reconciliationPending: boolean }> {
  const { oldTeamIds, removedDevIds } = await prepareTeamUpdate(project, team);
  return persistTeamUpdate(project, oldTeamIds, removedDevIds);
}

/** Validates and applies the requested team value before persistence. */
async function prepareTeamUpdate(
  project: any,
  team: any[],
): Promise<{ oldTeamIds: string[]; removedDevIds: string[] }> {
  const validation = await validateTeamDeveloperIds(team);
  if (!validation.valid) throw new AppError(validation.error || "Invalid team developer IDs", 400);
  const oldTeamIds = (project.team || []).map((id: any) => id.toString());
  const newTeamIdStrings = validation.devIds.map((id) => id.toString());
  const removedDevIds = oldTeamIds.filter((id: string) => !newTeamIdStrings.includes(id));
  project.team = validation.devIds;
  return { oldTeamIds, removedDevIds };
}

/** Runs team persistence and preserves rollback and standalone fallback behavior. */
async function persistTeamUpdate(
  project: any,
  oldTeamIds: string[],
  removedDevIds: string[],
): Promise<{ unassignedTasksCount: number; reconciliationPending: boolean }> {
  let session: mongoose.ClientSession | null = null;
  let unassignedTasksCount = 0;
  let reconciliationPending = false;
  try {
    if (concurrencyTestBarriers.beforeProjectSave) await concurrencyTestBarriers.beforeProjectSave();
    session = await mongoose.startSession();
    const result = await runProjectTeamTransaction(project, removedDevIds, session);
    unassignedTasksCount = result.unassignedTasksCount;
    reconciliationPending = result.reconciliationPending;
  } catch (err: any) {
    if (session && session.inTransaction()) await session.abortTransaction();
    unassignedTasksCount = await handleProjectTeamUpdateError(err, project, oldTeamIds, removedDevIds);
  } finally {
    if (session) await session.endSession();
  }
  return { unassignedTasksCount, reconciliationPending };
}

/** Applies the transaction's project, assignment, and reconciliation writes in order. */
async function runProjectTeamTransaction(
  project: any,
  removedDevIds: string[],
  session: mongoose.ClientSession,
): Promise<{ unassignedTasksCount: number; reconciliationPending: boolean }> {
  session.startTransaction();
  await project.save({ session });
  if (concurrencyTestBarriers.duringProjectTeamRemoval) {
    await concurrencyTestBarriers.duringProjectTeamRemoval();
  }
  let unassignedTasksCount = 0;
  let reconciliationPending = false;
  if (removedDevIds.length > 0) {
    unassignedTasksCount = await syncRemovedTeamTaskAssignments(project._id, removedDevIds, session);
  }
  await session.commitTransaction();
  if (removedDevIds.length > 0) {
    const swept = await reconcileAssignmentsSafely({ projectId: project._id });
    if (swept.ok) unassignedTasksCount += swept.result?.tasks ?? 0;
    else reconciliationPending = true;
  }
  return { unassignedTasksCount, reconciliationPending };
}

/** Preserves transaction-unavailable fallback, concurrency mapping, and other errors. */
async function handleProjectTeamUpdateError(
  err: any,
  project: any,
  oldTeamIds: string[],
  removedDevIds: string[],
): Promise<number> {
  if (isUnavailableTransactionError(err)) {
    if (config.NODE_ENV === "production") {
      console.error(JSON.stringify({
        level: "error",
        message: "MongoDB transactions unavailable: production requires a replica set",
        projectId: project._id.toString(),
      }));
      throw new AppError("Project team update is temporarily unavailable. Please try again later.", 503);
    }
    return saveStandaloneTeamUpdate(project, oldTeamIds, removedDevIds);
  }
  if (isConcurrentProjectWriteError(err)) {
    throw new AppError("Project was modified by another concurrent request. Please reload and try again.", 409);
  }
  throw err;
}

/** Applies the existing standalone team fallback and compensates failed cleanup. */
async function saveStandaloneTeamUpdate(
  project: any,
  oldTeamIds: string[],
  removedDevIds: string[],
): Promise<number> {
  await project.save();
  if (concurrencyTestBarriers.duringProjectTeamRemoval) {
    await concurrencyTestBarriers.duringProjectTeamRemoval();
  }
  let unassignedTasksCount = 0;
  if (removedDevIds.length > 0) {
    try {
      unassignedTasksCount = await syncRemovedTeamTaskAssignments(project._id, removedDevIds);
    } catch (updateErr) {
      project.team = oldTeamIds.map((id: string) => new mongoose.Types.ObjectId(id));
      await project.save();
      throw updateErr;
    }
  }
  return unassignedTasksCount;
}

function isUnavailableTransactionError(err: any): boolean {
  return err?.message?.includes("Transaction numbers are only allowed");
}

/**
 * Identifies concurrency errors mapped by Project update workflows.
 * Who may call it: Project update workflow helpers. Side effects: none.
 * Errors: none; returns whether the error matches a mapped concurrency failure.
 */
export function isConcurrentProjectWriteError(err: any): boolean {
  return err?.name === "VersionError" || err?.codeName === "WriteConflict" || err?.code === 112;
}
