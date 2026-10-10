import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Comment } from "../models/Comment.js";
import { Task } from "../models/Task.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";

export const commentsRouter = Router();

// Get comment counts grouped by taskId
commentsRouter.get("/counts", authenticate, async (_req, res) => {
  try {
    const counts = await Comment.aggregate([
      {
        $group: {
          _id: "$task",
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {};
    for (const item of counts) {
      if (item._id) result[item._id.toString()] = item.count;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comment counts" });
  }
});

// Get comments for a task
commentsRouter.get("/task/:taskId", authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.taskId)) {
      res.json([]);
      return;
    }

    const comments = await Comment.find({ task: req.params.taskId })
      .populate("author", "name email role")
      .sort({ createdAt: 1 });

    const formatted = comments.map((c: any) => ({
      id: c._id.toString(),
      task_id: c.task.toString(),
      body: c.body,
      created_at: c.createdAt.toISOString(),
      author:
        c.author && typeof c.author === "object"
          ? { id: c.author._id.toString(), name: c.author.name }
          : null,
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Add comment to task
commentsRouter.post("/task/:taskId", authenticate, async (req: AuthRequest, res) => {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) {
      res.status(400).json({ message: "Comment body is required" });
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

    const comment = await Comment.create({
      task: task._id,
      author: req.user!.id,
      body: body.trim(),
    });

    // Record activity
    await Activity.create({
      project: task.project,
      task: task._id,
      actor: req.user!.id,
      message: "added a comment",
    });

    // If author is not the assigned developer, notify developer
    if (task.assignedDeveloper && task.assignedDeveloper.toString() !== req.user!.id) {
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

    const populated: any = await Comment.findById(comment._id).populate("author", "name email");

    res.status(201).json({
      id: populated._id.toString(),
      task_id: populated.task.toString(),
      body: populated.body,
      created_at: populated.createdAt.toISOString(),
      author: populated.author
        ? { id: populated.author._id.toString(), name: populated.author.name }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// Delete comment (Author or Manager only)
commentsRouter.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    const isAuthor = comment.author.toString() === req.user!.id;
    const isManager = req.user!.role === "manager";

    if (!isAuthor && !isManager) {
      res.status(403).json({ message: "Not authorized to delete this comment" });
      return;
    }

    await comment.deleteOne();
    res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete comment" });
  }
});
