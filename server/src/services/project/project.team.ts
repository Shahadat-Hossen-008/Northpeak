// Project team validation and removed-member assignment cleanup.
// Called by project creation and update workflows.
// Shared team barriers remain owned by services/team.ts.

import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../../models/User.js";
import { Task } from "../../models/Task.js";
import { Subtask } from "../../models/Subtask.js";
import { concurrencyTestBarriers } from "../team.js";

/**
 * Validates developer IDs against registered developer users.
 * Who may call it: project create and update workflows. Side effects: database reads only.
 * Errors: returns validation messages "Team must be an array of developer IDs", "Invalid developer ID: <id>",
 * or "All team members must be registered developers" instead of throwing.
 */
export async function validateTeamDeveloperIds(
  team: any,
): Promise<{ valid: boolean; devIds: mongoose.Types.ObjectId[]; error?: string }> {
  if (!Array.isArray(team)) {
    return { valid: false, devIds: [], error: "Team must be an array of developer IDs" };
  }
  const uniqueIds = [
    ...new Set(team.map((id) => (typeof id === "string" ? id.trim() : String(id)))),
  ];
  for (const id of uniqueIds) {
    if (!isValidObjectId(id)) return { valid: false, devIds: [], error: `Invalid developer ID: ${id}` };
  }
  if (uniqueIds.length === 0) return { valid: true, devIds: [] };
  const devUsers = await User.find({ _id: { $in: uniqueIds }, role: "developer" }).select("_id");
  if (devUsers.length !== uniqueIds.length) {
    return { valid: false, devIds: [], error: "All team members must be registered developers" };
  }
  return { valid: true, devIds: devUsers.map((user) => user._id) };
}

/**
 * Clears open task and subtask assignments for developers removed from a project team.
 * Who may call it: the project update workflow. Side effects: updates open tasks and subtasks.
 * Errors: database errors propagate; simulated failure throws "Simulated database failure during bulk task unassignment".
 */
export async function syncRemovedTeamTaskAssignments(
  projectId: mongoose.Types.ObjectId | string,
  removedDevIds: string[],
  session?: mongoose.ClientSession,
): Promise<number> {
  if (removedDevIds.length === 0) return 0;
  if (concurrencyTestBarriers.simulateRemovalFailure) {
    throw new Error("Simulated database failure during bulk task unassignment");
  }
  const updateResult = await Task.updateMany(
    { project: projectId, assignedDeveloper: { $in: removedDevIds }, isCompleted: false },
    { $set: { assignedDeveloper: null, assignedBy: null } },
    session ? { session } : undefined,
  );
  const projectTasksQuery = Task.find({ project: projectId }).select("_id");
  if (session) projectTasksQuery.session(session);
  const projectTaskIds = await projectTasksQuery;
  await Subtask.updateMany(
    {
      task: { $in: projectTaskIds.map((task) => task._id) },
      assignedDeveloper: { $in: removedDevIds },
      isCompleted: false,
    },
    { $set: { assignedDeveloper: null } },
    session ? { session } : undefined,
  );
  return updateResult.modifiedCount || 0;
}
