import { isValidObjectId } from "mongoose";
import { Activity, type IActivity } from "../models/Activity.js";
import { AppError } from "../middleware/error.js";
import {
  serializeActivity,
  type SerializedActivity,
} from "../serializers/activity.serializer.js";

export interface GetActivitiesQuery {
  projectId?: any;
  taskId?: any;
  limit?: any;
}

export class ActivityService {
  async getActivities(query: GetActivitiesQuery): Promise<SerializedActivity[]> {
    const { projectId, taskId, limit } = query;
    const filter: Record<string, any> = {};

    if (projectId) {
      if (!isValidObjectId(projectId as string)) {
        throw new AppError("Invalid project ID", 400);
      }
      filter.project = projectId;
    }

    if (taskId) {
      if (!isValidObjectId(taskId as string)) {
        throw new AppError("Invalid task ID", 400);
      }
      filter.task = taskId;
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
