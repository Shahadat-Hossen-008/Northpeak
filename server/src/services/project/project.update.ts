// Project field and team updates with transaction and assignment safeguards.
// Called by the manager-only Project update route.
// Team barriers, rollback, reconciliation, and side-effect order are preserved.

import { isValidObjectId } from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Project } from "../../models/Project.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import {
  serializeProject,
  type SerializedProject,
} from "../../serializers/project.serializer.js";
import type { UpdateProjectInput } from "./project.shared.js";
import { isConcurrentProjectWriteError, updateProjectTeam } from "./project.team.update.js";

/**
 * Updates project fields or team membership while preserving assignment safeguards.
 * Who may call it: the authorized project manager. Side effects: project, task, subtask, activity writes.
 * Errors: 400 ("Team must be an array of developer IDs", "Invalid developer ID: <id>",
 * "All team members must be registered developers", or fallback "Invalid team developer IDs"
 * if a failed validation has no error message);
 * 403 ("Not authorized to modify this project"); 404 ("Project not found");
 * 409 ("Project was modified by another concurrent request. Please reload and try again.");
 * 503 ("Project team update is temporarily unavailable. Please try again later.").
 */
export async function updateProject(
  projectId: string,
  user: AuthUserPayload,
  input: UpdateProjectInput,
): Promise<SerializedProject> {
  // 1. Validate the project identifier.
  if (!isValidObjectId(projectId)) throw new AppError("Project not found", 404);
  // 2. Load the project and check project-manager authorization.
  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  if (project.manager.toString() !== user.id) {
    throw new AppError("Not authorized to modify this project", 403);
  }
  // 3. Apply scalar fields and persist the scalar or team update.
  const { title, description, start_date, deadline, priority, team } = input;
  applyScalarUpdates(project, { title, description, start_date, deadline, priority });
  const updateResult =
    team === undefined
      ? await saveProject(project)
      : await updateProjectTeam(project, team);
  const { unassignedTasksCount, reconciliationPending } = updateResult;
  // 4. Record the update activity after all project writes.
  await Activity.create({
    project: project._id,
    actor: user.id,
    message: `updated project details for ${project.title}`,
  });
  // 5. Return the serialized project and reconciliation metadata.
  const serialized = serializeProject(project);
  return {
    ...serialized,
    unassigned_open_tasks_count: unassignedTasksCount,
    ...(reconciliationPending ? { assignment_reconciliation_pending: true } : {}),
  };
}

/** Applies the scalar project fields in their existing order. */
function applyScalarUpdates(
  project: any,
  input: Pick<UpdateProjectInput, "title" | "description" | "start_date" | "deadline" | "priority">,
): void {
  const { title, description, start_date, deadline, priority } = input;
  if (title !== undefined) project.title = title.trim();
  if (description !== undefined) project.description = description.trim();
  if (start_date !== undefined) project.startDate = start_date ? new Date(start_date) : null;
  if (deadline !== undefined) project.deadline = deadline ? new Date(deadline) : null;
  if (priority !== undefined) project.priority = priority;
}

/** Saves a non-team project update and maps optimistic concurrency errors. */
async function saveProject(
  project: any,
): Promise<{ unassignedTasksCount: number; reconciliationPending: boolean }> {
  try {
    await project.save();
  } catch (err: any) {
    if (isConcurrentProjectWriteError(err)) {
      throw new AppError("Project was modified by another concurrent request. Please reload and try again.", 409);
    }
    throw err;
  }
  return { unassignedTasksCount: 0, reconciliationPending: false };
}

