// Read-only task listing and detail queries.
// Called by the task route layer.
// This module does not write data or trigger task side effects.

import { isValidObjectId } from "mongoose";
import { Project } from "../../models/Project.js";
import { Task } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import { escapeRegex } from "../../lib/utils.js";
import { serializeTask, type SerializedTask } from "../../serializers/task.serializer.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { getReadableTask } from "../task-access.js";

/**
 * Lists tasks visible to a manager or developer, with the supported query filters.
 * Who may call it: authenticated managers and developers. Side effects: none.
 * Errors: 403 ("Not authorized to read tasks") for other roles.
 */
export async function getTasks(user: AuthUserPayload, query: any): Promise<SerializedTask[]> {
  const filter = await buildTaskFilter(user, query);
  const tasks = await Task.find(filter)
    .populate("project", "title")
    .populate("assignedDeveloper", "name email")
    .populate("createdBy", "name")
    .populate("assignedBy", "name")
    .sort({ deadline: 1 });
  return tasks.map(serializeTask);
}

/** Builds the same role-scoped database filter and applies query parameters in their existing order. */
async function buildTaskFilter(
  user: AuthUserPayload,
  query: any,
): Promise<Record<string, any>> {
  const { project_id, projectId, assigned_to, assignedTo, priority, status, is_completed, search } =
    query;
  const filter = await buildRoleFilter(user);

  applyProjectFilter(filter, user, (project_id || projectId) as string);
  applyAssigneeFilter(filter, user, (assigned_to || assignedTo) as string);
  if (priority && typeof priority === "string") filter.priority = priority;
  if (status && typeof status === "string") filter.status = status;
  if (is_completed !== undefined) filter.isCompleted = is_completed === "true";
  if (search && typeof search === "string" && search.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
}

/** Applies the manager/developer base scope, retaining its manager project query. */
async function buildRoleFilter(user: AuthUserPayload): Promise<Record<string, any>> {
  const filter: Record<string, any> = {};
  if (user.role === "manager") {
    const projects = await Project.find({ manager: user.id }).select("_id");
    filter.project = { $in: projects.map((project) => project._id) };
  } else if (user.role === "developer") {
    filter.assignedDeveloper = user.id;
  } else {
    throw new AppError("Not authorized to read tasks", 403);
  }
  return filter;
}

/** Restricts project scope only when the supplied project value is a valid ObjectId. */
function applyProjectFilter(filter: Record<string, any>, user: AuthUserPayload, projectId: string): void {
  if (!projectId || !isValidObjectId(projectId)) return;
  if (user.role === "manager") {
    const authorizedProjectIds = filter.project.$in as any[];
    filter.project = {
      $in: authorizedProjectIds.filter((id) => id.toString() === projectId),
    };
  } else {
    filter.project = projectId;
  }
}

/** Applies the existing assignee filter and prevents developers from querying another assignee. */
function applyAssigneeFilter(filter: Record<string, any>, user: AuthUserPayload, assignedTo: string): void {
  if (!assignedTo || !isValidObjectId(assignedTo)) return;
  if (user.role === "developer" && assignedTo !== user.id) {
    filter._id = { $in: [] };
  } else if (user.role === "manager") {
    filter.assignedDeveloper = assignedTo;
  }
}

/**
 * Returns one task the user is allowed to read, populated for serialization.
 * Who may call it: authenticated users with task access. Side effects: none.
 * Errors: 404 ("Task not found") when the task is missing or outside the user's scope.
 */
export async function getTaskById(taskId: string, user: AuthUserPayload): Promise<SerializedTask> {
  const task = await getReadableTask(taskId, user);
  await task.populate("project", "title");
  await task.populate("assignedDeveloper", "name email");
  await task.populate("createdBy", "name");
  await task.populate("assignedBy", "name");
  return serializeTask(task);
}
