// Activity service: read-only activity feed ("who did what"), newest first.
// Called by routes/activity.ts.
// Must not write data or return anything except serialized activities.

// Who sees what:
//   manager   - activity on the projects they manage
//   developer - activity on tasks they can read, plus project-level events
//               (no task attached) on projects they belong to

import { isValidObjectId } from "mongoose";
import { Activity } from "../models/Activity.js";
import { AppError } from "../middleware/error.js";
import { serializeActivity, type SerializedActivity } from "../serializers/activity.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { canReadProject, getReadableTask, getReadableTaskIds } from "./task-access.js";

export interface GetActivitiesQuery {
  projectId?: any;
  taskId?: any;
  limit?: any;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100; // upper bound so one request cannot ask for an unbounded number of rows

/** Turns the ?limit= value into a number between 1 and MAX_LIMIT. */
function clampLimit(raw: unknown): number {
  const parsed = raw ? parseInt(raw as string, 10) : DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Number.isNaN(parsed) ? DEFAULT_LIMIT : parsed));
}

/** Filter for ?projectId=. A project the user cannot read answers 404 "Project not found". */
async function projectScope(
  projectId: string,
  user: AuthUserPayload,
): Promise<Record<string, any>> {
  if (!isValidObjectId(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }
  if (!(await canReadProject(projectId, user))) {
    throw new AppError("Project not found", 404);
  }
  if (user.role === "manager") {
    return { project: projectId };
  }

  // Developer: their own tasks in this project, plus project-level events
  const taskIds = await Task.find({ project: projectId, assignedDeveloper: user.id }).distinct(
    "_id",
  );
  return { $or: [{ task: { $in: taskIds } }, { task: null, project: projectId }] };
}

/** Filter for ?taskId=. getReadableTask throws if the user may not see the task. */
async function taskScope(taskId: string, user: AuthUserPayload): Promise<Record<string, any>> {
  if (!isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID", 400);
  }
  await getReadableTask(taskId, user);
  return { task: taskId };
}

/** Filter when no project or task is given: everything this user is allowed to see. */
async function workspaceScope(user: AuthUserPayload): Promise<Record<string, any>> {
  if (user.role === "manager") {
    return { project: { $in: await Project.find({ manager: user.id }).distinct("_id") } };
  }
  if (user.role === "developer") {
    const taskIds = await getReadableTaskIds(user);
    const projectIds = await Project.find({ team: user.id }).distinct("_id");
    return { $or: [{ task: { $in: taskIds } }, { task: null, project: { $in: projectIds } }] };
  }
  return {};
}

/**
 * Returns the activity feed for the signed-in user, newest first.
 * Who may call it: any authenticated user (the filter limits what they see).
 * Side effects: none, read-only.
 * Errors: 400 for a malformed project or task ID; 404 when the project is not
 * readable; getReadableTask's error when the task is not readable.
 */
export async function getActivities(
  user: AuthUserPayload,
  query: GetActivitiesQuery,
): Promise<SerializedActivity[]> {
  const { projectId, taskId, limit } = query;

  // The three scopes never use the same key, so they can be merged safely.
  const filter = {
    ...(projectId ? await projectScope(projectId, user) : {}),
    ...(taskId ? await taskScope(taskId, user) : {}),
    ...(!projectId && !taskId ? await workspaceScope(user) : {}),
  };

  const activities = await Activity.find(filter)
    .populate("actor", "name email")
    .sort({ createdAt: -1 })
    .limit(clampLimit(limit));

  return activities.map(serializeActivity);
}
