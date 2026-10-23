// Assignee rules for subtasks: eligibility check before a write and the team re-check after it.
// Called by the public service file only. All team membership questions go through ../team.js.
// Must not import from the public service file (no circular imports).

import { isValidObjectId } from "mongoose";
import { Subtask } from "../../models/Subtask.js";
import { User } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import { isDeveloperInProjectTeam } from "../team.js";
import { reconcileAssignmentsSafely } from "../reconcile.service.js";

/**
 * Validates a requested assignee and returns the developer id, or null to clear the assignment.
 * Throws 400 "Invalid developer ID", 404 "Developer not found", 400 "Assigned user must have
 * developer role" or 400 "Developer does not belong to the selected project's engineering team".
 */
export async function resolveAssignee(
  projectId: string,
  assignedDeveloperId: string | null,
): Promise<string | null> {
  if (assignedDeveloperId === null) return null;
  if (typeof assignedDeveloperId !== "string" || !isValidObjectId(assignedDeveloperId)) {
    throw new AppError("Invalid developer ID", 400);
  }

  const user = await User.findById(assignedDeveloperId).select("_id role");
  if (!user) throw new AppError("Developer not found", 404);
  if (user.role !== "developer") {
    throw new AppError("Assigned user must have developer role", 400);
  }
  if (!(await isDeveloperInProjectTeam(projectId, user._id))) {
    throw new AppError(
      "Developer does not belong to the selected project's engineering team",
      400,
    );
  }
  return user._id.toString();
}

/**
 * Post-write concurrency guard: if the assignee left the project team between validation and
 * the write, clear the assignment (never leave an open subtask with an ineligible assignee).
 * Throws 400 "Developer does not belong to the selected project's engineering team".
 */
export async function assertAssigneeStillInTeam(projectId: string, subtask: any): Promise<void> {
  const assigneeId = subtask.assignedDeveloper?.toString();
  if (!assigneeId) return;
  if (await isDeveloperInProjectTeam(projectId, assigneeId)) return;
  try {
    await Subtask.updateOne({ _id: subtask._id }, { $set: { assignedDeveloper: null } });
  } catch {
    await reconcileAssignmentsSafely({ projectId });
  }
  throw new AppError("Developer does not belong to the selected project's engineering team", 400);
}
