import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { subtaskService } from "../services/subtask.service.js";

export const subtasksRouter = Router();

// Get all subtasks (for overall progress calculation across board)
subtasksRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const subtasks = await subtaskService.getAllSubtasks(req.user!);
    res.json(subtasks);
  }),
);

// Get subtasks for a specific task
subtasksRouter.get(
  "/task/:taskId",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawTaskId = Array.isArray(req.params.taskId)
      ? (req.params.taskId[0] ?? "")
      : (req.params.taskId ?? "");
    const subtasks = await subtaskService.getSubtasksByTaskId(rawTaskId, req.user!);
    res.json(subtasks);
  }),
);

// Create subtask
subtasksRouter.post(
  "/task/:taskId",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawTaskId = Array.isArray(req.params.taskId)
      ? (req.params.taskId[0] ?? "")
      : (req.params.taskId ?? "");
    const subtask = await subtaskService.createSubtask(rawTaskId, req.user!, req.body);
    res.status(201).json(subtask);
  }),
);

// Update subtask (toggle or rename)
subtasksRouter.patch(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const subtask = await subtaskService.updateSubtask(rawId, req.user!, req.body);
    res.json(subtask);
  }),
);

// Delete subtask
subtasksRouter.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const result = await subtaskService.deleteSubtask(rawId, req.user!);
    res.json(result);
  }),
);
