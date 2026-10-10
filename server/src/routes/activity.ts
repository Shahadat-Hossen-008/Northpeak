import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Activity } from "../models/Activity.js";
import { authenticate } from "../middleware/auth.js";

export const activityRouter = Router();

// Get recent activity (optionally filter by projectId or taskId)
activityRouter.get("/", authenticate, async (req, res) => {
  try {
    const { projectId, taskId, limit } = req.query;
    const filter: Record<string, any> = {};

    if (projectId && isValidObjectId(projectId as string)) {
      filter.project = projectId;
    }
    if (taskId && isValidObjectId(taskId as string)) {
      filter.task = taskId;
    }

    const max = limit ? parseInt(limit as string, 10) : 20;

    const activities = await Activity.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .limit(max);

    const formatted = activities.map((a: any) => ({
      id: a._id.toString(),
      message: a.message,
      created_at: a.createdAt.toISOString(),
      project_id: a.project ? a.project.toString() : null,
      task_id: a.task ? a.task.toString() : null,
      actor:
        a.actor && typeof a.actor === "object"
          ? { id: a.actor._id.toString(), name: a.actor.name }
          : null,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch activity" });
  }
});
