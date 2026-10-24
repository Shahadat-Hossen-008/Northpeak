// Task deletion and its dependent-record cleanup.
// Called by the manager-only task deletion route.
// Cascade queries and their order match the existing task service.

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
 * Deletes a task after project-manager authorization and removes its dependent records.
 * Who may call it: authenticated project managers. Side effects: deletes subtasks, comments, activity, notifications, and task.
 * Errors: 404 ("Task not found") for invalid or missing task IDs; 403 ("Not authorized to delete tasks for this project") otherwise.
 */
export async function deleteTask(
  taskId: string,
  user: AuthUserPayload,
): Promise<{ success: boolean; message: string }> {
  // 1. Validate the task identifier.
  if (!isValidObjectId(taskId)) throw new AppError("Task not found", 404);
  // 2. Load the task and project needed for authorization.
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);

  const project = await Project.findById(task.project);
  // 3. Require the project manager before deleting any records.
  if (!project || project.manager.toString() !== user.id) {
    throw new AppError("Not authorized to delete tasks for this project", 403);
  }

  // 4. Remove dependent records in their existing order.
  await Subtask.deleteMany({ task: task._id });
  await Comment.deleteMany({ task: task._id });
  await Activity.deleteMany({ task: task._id });
  await Notification.deleteMany({ task: task._id });
  // 5. Delete the task after its dependent records.
  await task.deleteOne();
  // 6. Return the existing success response.
  return { success: true, message: "Task deleted successfully" };
}
