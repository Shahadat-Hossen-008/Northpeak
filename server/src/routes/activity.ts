import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { activityService } from "../services/activity.service.js";

export const activityRouter = Router();

// Get recent activity (optionally filter by projectId or taskId)
activityRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const activities = await activityService.getActivities(req.user!, req.query);
    res.json(activities);
  }),
);
