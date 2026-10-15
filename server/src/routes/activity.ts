import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { activityService } from "../services/activity.service.js";

export const activityRouter = Router();

// Get recent activity (optionally filter by projectId or taskId)
activityRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const activities = await activityService.getActivities(req.query);
    res.json(activities);
  }),
);
