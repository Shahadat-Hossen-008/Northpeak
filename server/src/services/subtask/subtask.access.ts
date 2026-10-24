// Loads a subtask's parent task and project and checks who may view subtasks.
// Called by the public service file only; the create, update and delete permission checks
// stay in the service because each has its own message and position in the sequence.
// Must not import from the public service file (no circular imports).

import type { Types } from "mongoose";
import { Task } from "../../models/Task.js";
import { Project } from "../../models/Project.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";

/** Loads the task, then its project. Throws 404 "Task not found" or "Project not found". */
export async function loadTaskAndProject(taskId: string | Types.ObjectId) {
  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const project = await Project.findById(task.project);
  if (!project) {
    throw new AppError("Project not found", 404);
  }

  return { task, project };
}

/**
 * Read access to a task's subtasks: the project's manager or the task's assignee.
 * Throws 404 when the task or project is missing and 403 otherwise.
 */
export async function canAccessTask(taskId: string, user: AuthUserPayload) {
  const { task, project } = await loadTaskAndProject(taskId);

  const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
  const isAssignee = task.assignedDeveloper?.toString() === user.id;
  if (!isProjectManager && !isAssignee) {
    throw new AppError("Not authorized to view subtasks for this task", 403);
  }

  return task;
}
