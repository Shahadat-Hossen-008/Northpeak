import { Router } from "express";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { taskService } from "../services/task.service.js";

export const tasksRouter = Router();

// Get all tasks (supports project_id/projectId, assigned_to/assignedTo, priority, status, is_completed, search query filters)
tasksRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const tasks = await taskService.getTasks(req.user!, req.query);
    res.json(tasks);
  }),
);

// Get single task by ID
tasksRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const task = await taskService.getTaskById(rawId, req.user!);
    res.json(task);
  }),
);

// Create task (Manager only)
tasksRouter.post(
  "/",
  authenticate,
  requireRole("manager"),
  asyncHandler(async (req: AuthRequest, res) => {
    const task = await taskService.createTask(req.user!, req.body);
    res.status(201).json(task);
  }),
);

// Update / Reassign task (Manager or Assigned Developer)
tasksRouter.patch(
  "/:id",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const task = await taskService.updateTask(rawId, req.user!, req.body);
    res.json(task);
  }),
);

// Toggle completion specifically
tasksRouter.patch(
  "/:id/complete",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const task = await taskService.toggleComplete(rawId, req.user!, req.body.completed);
    res.json(task);
  }),
);

// Delete task (Manager only)
tasksRouter.delete(
  "/:id",
  authenticate,
  requireRole("manager"),
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const result = await taskService.deleteTask(rawId, req.user!);
    res.json(result);
  }),
);
