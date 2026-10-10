import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Subtask } from "../models/Subtask.js";
import { Task } from "../models/Task.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const subtasksRouter = Router();

function formatSubtask(s: any) {
  return {
    id: s._id.toString(),
    task_id: s.task.toString(),
    title: s.title,
    is_completed: Boolean(s.isCompleted),
    completed_at: s.completedAt ? new Date(s.completedAt).toISOString() : null,
    created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
  };
}

// Get all subtasks (for overall progress calculation across board)
subtasksRouter.get("/", authenticate, async (_req, res) => {
  try {
    const subtasks = await Subtask.find().sort({ createdAt: 1 });
    res.json(subtasks.map(formatSubtask));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subtasks" });
  }
});

// Get subtasks for a specific task
subtasksRouter.get("/task/:taskId", authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.taskId)) {
      res.json([]);
      return;
    }

    const subtasks = await Subtask.find({ task: req.params.taskId }).sort({ createdAt: 1 });
    res.json(subtasks.map(formatSubtask));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch task subtasks" });
  }
});

// Create subtask
subtasksRouter.post("/task/:taskId", authenticate, async (req: AuthRequest, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ message: "Subtask title is required" });
      return;
    }

    if (!isValidObjectId(req.params.taskId)) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const subtask = await Subtask.create({
      task: task._id,
      title: title.trim(),
    });

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: req.user!.id,
      message: `added subtask "${subtask.title}"`,
    });

    res.status(201).json(formatSubtask(subtask));
  } catch (error) {
    res.status(500).json({ message: "Failed to create subtask" });
  }
});

// Update subtask (toggle or rename)
subtasksRouter.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Subtask not found" });
      return;
    }

    const subtask = await Subtask.findById(req.params.id);
    if (!subtask) {
      res.status(404).json({ message: "Subtask not found" });
      return;
    }

    const task = await Task.findById(subtask.task);
    const { title, is_completed } = req.body;

    if (title !== undefined) {
      subtask.title = title.trim();
    }

    if (is_completed !== undefined) {
      const nowDone = Boolean(is_completed);
      subtask.isCompleted = nowDone;
      subtask.completedAt = nowDone ? new Date() : null;

      // Notify manager if completed
      if (nowDone && task) {
        await Notification.create({
          audience: "manager",
          kind: "subtask_completed",
          title: "Subtask completed",
          body: `${subtask.title} was marked complete.`,
          task: task._id,
          project: task.project,
        });
      }
    }

    await subtask.save();
    res.json(formatSubtask(subtask));
  } catch (error) {
    res.status(500).json({ message: "Failed to update subtask" });
  }
});

// Delete subtask
subtasksRouter.delete("/:id", authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Subtask not found" });
      return;
    }

    const subtask = await Subtask.findById(req.params.id);
    if (!subtask) {
      res.status(404).json({ message: "Subtask not found" });
      return;
    }

    await subtask.deleteOne();
    res.json({ success: true, message: "Subtask deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete subtask" });
  }
});
