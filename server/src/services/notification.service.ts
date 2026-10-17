import { isValidObjectId } from "mongoose";
import { Notification, type INotification } from "../models/Notification.js";
import {
  serializeNotification,
  type SerializedNotification,
} from "../serializers/notification.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";

export class NotificationService {
  async getUserNotifications(user: AuthUserPayload): Promise<SerializedNotification[]> {
    const notifications = await Notification.find({
      $or: [
        { recipient: user.id },
        { recipient: null, audience: user.role },
        { recipient: null, audience: null },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    return notifications.map(serializeNotification);
  }

  async markNotificationsRead(
    user: AuthUserPayload,
    ids: any,
  ): Promise<{ success: boolean }> {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true };
    }

    const validIds = ids.filter((id: any) => typeof id === "string" && isValidObjectId(id));
    if (validIds.length > 0) {
      await Notification.updateMany(
        {
          _id: { $in: validIds },
          $or: [
            { recipient: user.id },
            { recipient: null, audience: user.role },
            { recipient: null, audience: null },
          ],
        },
        { $set: { isRead: true } },
      );
    }

    return { success: true };
  }
}

export const notificationService = new NotificationService();
