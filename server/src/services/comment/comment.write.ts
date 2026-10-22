// Comment write workflows: create, delete, and update task comments.
// Re-exported by the public comment service module and called by routes/comments.ts.
// Must preserve exact await order, permission checks, activity logging, and notification broadcasts.

import { isValidObjectId } from "mongoose";
import { Comment } from "../../models/Comment.js";
import { Task } from "../../models/Task.js";
import { Project } from "../../models/Project.js";
import { Activity } from "../../models/Activity.js";
import { Notification } from "../../models/Notification.js";
import { AppError } from "../../middleware/error.js";
import { serializeComment, type SerializedComment } from "../../serializers/comment.serializer.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { getReadableTask } from "../task-access.js";

export interface CreateCommentInput {
  body?: string;
}

export interface UpdateCommentInput {
  body?: unknown;
}

/**
 * Creates a comment on a task, logs activity, and sends notifications.
 * Who may call it: any authenticated user who can read the task.
 * Side effects: creates Comment, creates Activity, notifies assigned developer (if not the author),
 * and broadcasts a notification to the manager audience.
 * Errors: 400 ("Comment body is required") if body is missing/blank;
 * 404 ("Task not found") if taskId format is invalid, task is missing, or task is unreadable by the caller.
 */
export async function createComment(
  taskId: string,
  user: AuthUserPayload,
  input: CreateCommentInput,
): Promise<SerializedComment> {
  // 1. Validate input
  const { body } = input;
  if (!body || !body.trim()) {
    throw new AppError("Comment body is required", 400);
  }

  if (!isValidObjectId(taskId)) {
    throw new AppError("Task not found", 404);
  }

  // 2. Load what it needs
  // 3. Check permission (getReadableTask enforces project/task read access)
  const task = await getReadableTask(taskId, user);

  // 4. Apply the rule or change
  const comment = await Comment.create({
    task: task._id,
    author: user.id,
    body: body.trim(),
  });

  // 5. Side effects (activity, notifications)
  await Activity.create({
    project: task.project,
    task: task._id,
    actor: user.id,
    message: "added a comment",
  });

  // Skip self-notification when the comment author is the assigned developer
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

  await Notification.create({
    audience: "manager",
    kind: "new_comment",
    title: `New comment on ${task.title}`,
    body: comment.body.slice(0, 140),
    task: task._id,
    project: task.project,
  });

  // 6. Return the serialized result
  const populated = await Comment.findById(comment._id).populate("author", "name email role");

  return serializeComment(populated);
}

/**
 * Deletes an existing comment.
 * Who may call it: the comment author, or the manager of the project the task belongs to.
 * Side effects: deletes the Comment document.
 * Errors: 404 ("Comment not found") if commentId is invalid or comment is missing;
 * 404 ("Task not found") if the parent task is missing or unreadable by the caller;
 * 403 ("Not authorized to delete this comment") if the caller is neither the comment author nor the project's manager.
 */
export async function deleteComment(
  commentId: string,
  user: AuthUserPayload,
): Promise<{ success: boolean; message: string }> {
  // 1. Validate input
  if (!isValidObjectId(commentId)) {
    throw new AppError("Comment not found", 404);
  }

  // 2. Load what it needs
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }
  await getReadableTask(comment.task.toString(), user);

  // 3. Check permission
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

  // 4. Apply the rule or change
  await comment.deleteOne();

  // 5. Return the serialized result
  return { success: true, message: "Comment deleted" };
}

/**
 * Updates the body of an existing comment.
 * Who may call it: only the comment author (must also still be able to read the parent task).
 * Side effects: updates and saves the Comment document.
 * Errors: 404 ("Comment not found") if commentId is invalid or comment is missing;
 * 404 ("Task not found") if the parent task is missing or unreadable by the caller;
 * 403 ("Not authorized to edit this comment") if the caller is not the comment author;
 * 400 ("Comment body is required") if body is not a non-empty string.
 */
export async function updateComment(
  commentId: string,
  user: AuthUserPayload,
  input: UpdateCommentInput,
): Promise<SerializedComment> {
  // 1. Validate input
  if (!isValidObjectId(commentId)) {
    throw new AppError("Comment not found", 404);
  }

  // 2. Load what it needs
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }
  await getReadableTask(comment.task.toString(), user);

  // 3. Check permission
  if (comment.author.toString() !== user.id) {
    throw new AppError("Not authorized to edit this comment", 403);
  }

  // Checked after author check so non-authors receive 403 before 400 body validation
  if (typeof input.body !== "string" || !input.body.trim()) {
    throw new AppError("Comment body is required", 400);
  }

  // 4. Apply the rule or change
  comment.body = input.body.trim();
  await comment.save();

  // 5. Return the serialized result
  const populated = await Comment.findById(comment._id).populate("author", "name email role");
  return serializeComment(populated);
}
