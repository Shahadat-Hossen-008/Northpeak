import { isValidObjectId } from "mongoose";
import { Comment, type IComment } from "../models/Comment.js";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../middleware/error.js";
import { serializeComment, type SerializedComment } from "../serializers/comment.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";
import { getReadableTask, getReadableTaskIds } from "./task-access.js";

export interface CreateCommentInput {
  body?: string;
}

export interface UpdateCommentInput {
  body?: unknown;
}

export class CommentService {
  async getCommentCounts(user: AuthUserPayload): Promise<Record<string, number>> {
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

  async getCommentsForTask(taskId: string, user: AuthUserPayload): Promise<SerializedComment[]> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Invalid task ID format", 400);
    }
    await getReadableTask(taskId, user);

    const comments = await Comment.find({ task: taskId })
      .populate("author", "name email role")
      .sort({ createdAt: 1 });

    return comments.map(serializeComment);
  }

  async createComment(
    taskId: string,
    user: AuthUserPayload,
    input: CreateCommentInput,
  ): Promise<SerializedComment> {
    const { body } = input;
    if (!body || !body.trim()) {
      throw new AppError("Comment body is required", 400);
    }

    if (!isValidObjectId(taskId)) {
      throw new AppError("Task not found", 404);
    }

    const task = await getReadableTask(taskId, user);

    const comment = await Comment.create({
      task: task._id,
      author: user.id,
      body: body.trim(),
    });

    // Record activity
    await Activity.create({
      project: task.project,
      task: task._id,
      actor: user.id,
      message: "added a comment",
    });

    // If author is not the assigned developer, notify developer
    if (task.assignedDeveloper && task.assignedDeveloper.toString() !== user.id) {
      await Notification.create({
        recipient: task.assignedDeveloper,
        kind: "new_comment",
        title: "New comment on task",
        body: comment.body.slice(0, 140),
        task: task._id,
        project: task.project,
      });
    }

    // Broadcast notification to manager audience
    await Notification.create({
      audience: "manager",
      kind: "new_comment",
      title: `New comment on ${task.title}`,
      body: comment.body.slice(0, 140),
      task: task._id,
      project: task.project,
    });

    const populated = await Comment.findById(comment._id).populate("author", "name email role");

    return serializeComment(populated);
  }

  async deleteComment(
    commentId: string,
    user: AuthUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(commentId)) {
      throw new AppError("Comment not found", 404);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }
    await getReadableTask(comment.task.toString(), user);

    const isAuthor = comment.author.toString() === user.id;
    if (!isAuthor) {
      if (user.role !== "manager") {
        throw new AppError("Not authorized to delete this comment", 403);
      }

      const task = await Task.findById(comment.task);
      if (!task) {
        throw new AppError("Task not found", 404);
      }

      const project = await Project.findById(task.project);
      if (!project || project.manager.toString() !== user.id) {
        throw new AppError("Not authorized to delete this comment", 403);
      }
    }

    await comment.deleteOne();
    return { success: true, message: "Comment deleted" };
  }

  async updateComment(
    commentId: string,
    user: AuthUserPayload,
    input: UpdateCommentInput,
  ): Promise<SerializedComment> {
    if (!isValidObjectId(commentId)) {
      throw new AppError("Comment not found", 404);
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }
    await getReadableTask(comment.task.toString(), user);

    if (comment.author.toString() !== user.id) {
      throw new AppError("Not authorized to edit this comment", 403);
    }

    if (typeof input.body !== "string" || !input.body.trim()) {
      throw new AppError("Comment body is required", 400);
    }

    comment.body = input.body.trim();
    await comment.save();

    const populated = await Comment.findById(comment._id).populate("author", "name email role");
    return serializeComment(populated);
  }
}

export const commentService = new CommentService();
