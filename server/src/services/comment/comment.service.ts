// Comment service: public entrypoint and read-only comment queries.
// Called by routes/comments.ts.
// Read queries must not write data or trigger side effects; write workflows are re-exported from comment.write.ts.

import { isValidObjectId } from "mongoose";
import { Comment } from "../../models/Comment.js";
import { AppError } from "../../middleware/error.js";
import { serializeComment, type SerializedComment } from "../../serializers/comment.serializer.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { getReadableTask, getReadableTaskIds } from "../task-access.js";

export type { CreateCommentInput, UpdateCommentInput } from "./comment.write.js";

/**
 * Returns a map of taskId to comment count for all tasks the user can read.
 * Who may call it: any authenticated user.
 * Side effects: none (read-only aggregation).
 * Errors: none.
 */
export async function getCommentCounts(user: AuthUserPayload): Promise<Record<string, number>> {
  const taskIds = await getReadableTaskIds(user);
  const counts = await Comment.aggregate([
    { $match: { task: { $in: taskIds } } },
    {
      $group: {
        _id: "$task",
        count: { $sum: 1 },
      },
    },
  ]);

  const result: Record<string, number> = {};
  for (const item of counts) {
    if (item._id) {
      result[item._id.toString()] = item.count;
    }
  }
  return result;
}

/**
 * Returns all comments for a readable task, ordered oldest first (createdAt ascending).
 * Who may call it: any authenticated user who can read the task.
 * Side effects: none (read-only).
 * Errors: 400 ("Invalid task ID format") if taskId is not a valid ObjectId;
 * 404 ("Task not found") from getReadableTask if the task is missing or unreadable by the caller.
 */
export async function getCommentsForTask(
  taskId: string,
  user: AuthUserPayload,
): Promise<SerializedComment[]> {
  if (!isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID format", 400);
  }
  await getReadableTask(taskId, user);

  const comments = await Comment.find({ task: taskId })
    .populate("author", "name email role")
    .sort({ createdAt: 1 });

  return comments.map(serializeComment);
}

export { createComment, deleteComment, updateComment } from "./comment.write.js";
