import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import * as commentService from "../services/comment/comment.service.js";

export const commentsRouter = Router();

// Get comment counts grouped by taskId
commentsRouter.get(
  "/counts",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const counts = await commentService.getCommentCounts(req.user!);
    res.json(counts);
  }),
);

// Get comments for a task
commentsRouter.get(
  "/task/:taskId",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawTaskId = Array.isArray(req.params.taskId)
      ? (req.params.taskId[0] ?? "")
      : (req.params.taskId ?? "");
    const comments = await commentService.getCommentsForTask(rawTaskId, req.user!);
    res.json(comments);
  }),
);

// Add comment to task
commentsRouter.post(
  "/task/:taskId",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawTaskId = Array.isArray(req.params.taskId)
      ? (req.params.taskId[0] ?? "")
      : (req.params.taskId ?? "");
    const comment = await commentService.createComment(rawTaskId, req.user!, req.body);
    res.status(201).json(comment);
  }),
);

commentsRouter.patch(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const comment = await commentService.updateComment(rawId, req.user!, req.body);
    res.json(comment);
  }),
);

// Delete comment (Author or Manager only)
commentsRouter.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const result = await commentService.deleteComment(rawId, req.user!);
    res.json(result);
  }),
);
