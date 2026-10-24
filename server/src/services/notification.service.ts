// Notification service: lists a user's notifications and marks them as read.
// Called by routes/notifications.ts.
// Must not create notifications or touch other users' notifications.
//
// A notification is visible to a user when it is:
//   - addressed to them (recipient),
//   - broadcast to their role (no recipient, audience = their role), or
//   - global (no recipient, no audience).

import { isValidObjectId } from "mongoose";
import { Notification } from "../models/Notification.js";
import {
  serializeNotification,
  type SerializedNotification,
} from "../serializers/notification.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";

const MAX_NOTIFICATIONS = 50;

/**
 * Query filter for "notifications this user may see".
 * Shared by the list and mark-read functions so a user can only mark as read
 * what they can see (covered by the SEC-B test in phase1-hardening.test.ts).
 */
function visibleTo(user: AuthUserPayload): Record<string, any> {
  return {
    $or: [
      { recipient: user.id },
      { recipient: null, audience: user.role },
      { recipient: null, audience: null },
    ],
  };
}

/**
 * Returns the user's newest notifications, newest first, capped at MAX_NOTIFICATIONS.
 * Who may call it: any authenticated user.
 * Side effects: none, read-only.
 */
export async function getUserNotifications(
  user: AuthUserPayload,
): Promise<SerializedNotification[]> {
  const notifications = await Notification.find(visibleTo(user))
    .sort({ createdAt: -1 })
    .limit(MAX_NOTIFICATIONS);

  return notifications.map(serializeNotification);
}

/**
 * Marks the given notifications as read, but only those the user may see.
 * Who may call it: any authenticated user.
 * Side effects: sets isRead = true on the matching notifications.
 * Errors: none. Invalid, unknown or foreign IDs are ignored and the response
 * is always { success: true }.
 */
export async function markNotificationsRead(
  user: AuthUserPayload,
  ids: any,
): Promise<{ success: boolean }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true };
  }

  // Keep only well-formed string IDs; anything else is ignored
  const validIds = ids.filter((id: any) => typeof id === "string" && isValidObjectId(id));
  if (validIds.length > 0) {
    await Notification.updateMany(
      { _id: { $in: validIds }, ...visibleTo(user) },
      { $set: { isRead: true } },
    );
  }

  return { success: true };
}
