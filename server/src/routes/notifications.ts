import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import * as notificationService from "../services/notification.service.js";

export const notificationsRouter = Router();

// Get notifications for current user (direct recipient or audience matching role)
notificationsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const notifications = await notificationService.getUserNotifications(req.user!);
    res.json(notifications);
  }),
);

// Mark notifications as read
notificationsRouter.patch(
  "/mark-read",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await notificationService.markNotificationsRead(req.user!, req.body.ids);
    res.json(result);
  }),
);
