import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Notification } from "../models/Notification.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const notificationsRouter = Router();

// Get notifications for current user (direct recipient or audience matching role)
notificationsRouter.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const notifications = await Notification.find({
      $or: [
        { recipient: user.id },
        { recipient: null, audience: user.role },
        { recipient: null, audience: null },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const formatted = notifications.map((n) => ({
      id: n._id.toString(),
      kind: n.kind,
      title: n.title,
      body: n.body,
      is_read: n.isRead,
      created_at: n.createdAt.toISOString(),
      task_id: n.task ? n.task.toString() : null,
      project_id: n.project ? n.project.toString() : null,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Mark notifications as read
notificationsRouter.patch("/mark-read", authenticate, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.json({ success: true });
      return;
    }

    const validIds = ids.filter((id: any) => typeof id === "string" && isValidObjectId(id));
    if (validIds.length > 0) {
      await Notification.updateMany({ _id: { $in: validIds } }, { $set: { isRead: true } });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
});
