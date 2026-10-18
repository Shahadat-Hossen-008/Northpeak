import { isValidObjectId } from "mongoose";
import { Task, type ITask } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/error.js";
import type { AuthUserPayload } from "../middleware/auth.js";

/** Shared read boundary for task content (tasks, comments, and task activity). */
export async function getReadableTask(taskId: string, user: AuthUserPayload): Promise<ITask> {
  if (!isValidObjectId(taskId)) throw new AppError("Task not found", 404);
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);

  let allowed = false;
  if (user.role === "manager") {
    const project = await Project.findById(task.project).select("manager");
    allowed = Boolean(project && project.manager.toString() === user.id);
  } else if (user.role === "developer") {
    allowed = task.assignedDeveloper?.toString() === user.id;
  }

  if (!allowed) throw new AppError("Task not found", 404);
  return task;
}

export async function getReadableTaskIds(user: AuthUserPayload) {
  if (user.role === "manager") {
    const projects = await Project.find({ manager: user.id }).select("_id");
    return Task.find({ project: { $in: projects.map((project) => project._id) } }).distinct("_id");
  }
  if (user.role === "developer") return Task.find({ assignedDeveloper: user.id }).distinct("_id");
  return [];
}

export async function canReadProject(projectId: unknown, user: AuthUserPayload): Promise<boolean> {
  if (user.role === "manager") {
    return Boolean(await Project.exists({ _id: projectId, manager: user.id }));
  }
  if (user.role === "developer") {
    const isTeamMember = await Project.exists({ _id: projectId, team: user.id });
    if (isTeamMember) return true;
    return Boolean(await Task.exists({ project: projectId, assignedDeveloper: user.id }));
  }
  return false;
}
