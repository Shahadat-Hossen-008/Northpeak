// Task completion and reopening workflow.
// Called by routes/tasks.ts for a project manager or task assignee.
// It records the existing completion activity after the task save.

import { isValidObjectId } from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Project } from "../../models/Project.js";
import { Task, type ITask } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import type { SerializedTask } from "../../serializers/task.serializer.js";
import { applyTaskWorkflowState, fetchPopulatedTask, parseRequiredBoolean } from "./task.shared.js";

/**
 * Completes or reopens a task for its project manager or assignee.
 * Who may call it: authenticated project managers and task assignees. Side effects: task and activity writes.
 * Errors: 400 ("completed must be a boolean"); 403 ("Not authorized to update this task");
 * 404 ("Task not found" or "Project not found"). Database errors propagate.
 */
export async function toggleComplete(
  taskId: string,
  user: AuthUserPayload,
  completed: unknown,
): Promise<SerializedTask> {
  // 1. Load the task and project in the existing query order.
  // 2. Enforce manager or assignee access before validating the requested state.
  const task = await loadTaskForCompletion(taskId, user);
  // 3. Validate the requested completion state.
  const parsedCompleted = parseRequiredBoolean(completed, "completed");
  // 4. Apply the completion state and persist it.
  applyTaskWorkflowState(task, undefined, parsedCompleted);
  const isCompleted = task.isCompleted;
  await task.save();
  // 5. Record the completion activity after saving the task.
  await Activity.create({
    project: task.project,
    task: task._id,
    actor: user.id,
    message: `${isCompleted ? "completed" : "reopened"} ${task.title}`,
  });
  // 6. Return the populated task representation.
  return fetchPopulatedTask(task._id);
}

/** Loads the task and project before applying the original completion authorization rule. */
async function loadTaskForCompletion(taskId: string, user: AuthUserPayload): Promise<ITask> {
  if (!isValidObjectId(taskId)) throw new AppError("Task not found", 404);
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);
  const project = await Project.findById(task.project);
  if (!project) throw new AppError("Project not found", 404);

  const isManager = user.role === "manager";
  const isProjectManager = isManager && project.manager.toString() === user.id;
  const isAssignee = task.assignedDeveloper?.toString() === user.id;
  if (!isProjectManager && !isAssignee) {
    throw new AppError("Not authorized to update this task", 403);
  }
  return task;
}
