// Project deletion and dependent-record cleanup.
// Called by the manager-only Project deletion route.
// Cascade queries and their order match the existing Project service.

import { isValidObjectId } from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Comment } from "../../models/Comment.js";
import { Notification } from "../../models/Notification.js";
import { Project } from "../../models/Project.js";
import { Subtask } from "../../models/Subtask.js";
import { Task } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";

/**
 * Deletes a project after manager authorization and removes dependent records.
 * Who may call it: the authorized project manager. Side effects: deletes subtasks, comments, tasks, activity, notifications, and project.
 * Errors: 404 ("Project not found") or 403 ("Not authorized to delete this project").
 */
export async function deleteProject(
  projectId: string,
  user: AuthUserPayload,
): Promise<{ success: boolean; message: string }> {
  // 1. Validate the project identifier.
  if (!isValidObjectId(projectId)) throw new AppError("Project not found", 404);
  // 2. Load the project and its tasks.
  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  // 3. Check project-manager authorization.
  if (project.manager.toString() !== user.id) {
    throw new AppError("Not authorized to delete this project", 403);
  }
  const tasks = await Task.find({ project: project._id }).select("_id");
  const taskIds = tasks.map((task) => task._id);
  // 4. Remove dependent records in their existing order.
  await Subtask.deleteMany({ task: { $in: taskIds } });
  await Comment.deleteMany({ task: { $in: taskIds } });
  await Task.deleteMany({ _id: { $in: taskIds } });
  await Activity.deleteMany({ project: project._id });
  await Notification.deleteMany({ project: project._id });
  // 5. Delete the project.
  await project.deleteOne();
  // 6. Return the existing success response.
  return {
    success: true,
    message: `Project ${project.title} and related items deleted`,
  };
}
