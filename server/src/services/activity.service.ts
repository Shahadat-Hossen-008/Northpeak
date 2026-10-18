import { isValidObjectId } from "mongoose";
import { Activity, type IActivity } from "../models/Activity.js";
import { AppError } from "../middleware/error.js";
import {
  serializeActivity,
  type SerializedActivity,
} from "../serializers/activity.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { canReadProject, getReadableTask, getReadableTaskIds } from "./task-access.js";

export interface GetActivitiesQuery {
  projectId?: any;
  taskId?: any;
  limit?: any;
}

export class ActivityService {
  async getActivities(user: AuthUserPayload, query: GetActivitiesQuery): Promise<SerializedActivity[]> {
    const { projectId, taskId, limit } = query;
    const filter: Record<string, any> = {};

    if (projectId) {
      if (!isValidObjectId(projectId as string)) {
        throw new AppError("Invalid project ID", 400);
      }
      if (!(await canReadProject(projectId, user))) throw new AppError("Project not found", 404);
      if (user.role === "manager") {
        filter.project = projectId;
      } else {
        const taskIds = await Task.find({ project: projectId, assignedDeveloper: user.id }).distinct("_id");
        filter.$or = [{ task: { $in: taskIds } }, { task: null, project: projectId }];
      }
    }

    if (taskId) {
      if (!isValidObjectId(taskId as string)) {
        throw new AppError("Invalid task ID", 400);
      }
      await getReadableTask(taskId as string, user);
      filter.task = taskId;
    }

    if (!taskId && !projectId && user.role === "manager") {
      filter.project = { $in: await Project.find({ manager: user.id }).distinct("_id") };
    } else if (!taskId && !projectId && user.role === "developer") {
      const taskIds = await getReadableTaskIds(user);
      const projectIds = await Project.find({ team: user.id }).distinct("_id");
      filter.$or = [
        { task: { $in: taskIds } },
        { task: null, project: { $in: projectIds } },
      ];
    }

    const parsed = limit ? parseInt(limit as string, 10) : 20;
    const max = Math.min(100, Math.max(1, isNaN(parsed) ? 20 : parsed));

    const activities = await Activity.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .limit(max);

    return activities.map(serializeActivity);
  }
}

export const activityService = new ActivityService();
