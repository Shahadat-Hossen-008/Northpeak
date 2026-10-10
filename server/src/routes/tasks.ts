import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";

export const tasksRouter = Router();

function formatTask(task: any) {
  return {
    id: task._id.toString(),
    project_id: task.project?._id ? task.project._id.toString() : task.project?.toString() || "",
    title: task.title,
    description: task.description || "",
    assigned_developer_id: task.assignedDeveloper?._id
      ? task.assignedDeveloper._id.toString()
      : task.assignedDeveloper
        ? task.assignedDeveloper.toString()
        : null,
    deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
    priority: task.priority,
    is_completed: Boolean(task.isCompleted),
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    created_at: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
    project:
      task.project && typeof task.project === "object" && task.project.title
        ? { id: task.project._id.toString(), title: task.project.title }
        : null,
    assignee:
      task.assignedDeveloper &&
      typeof task.assignedDeveloper === "object" &&
      task.assignedDeveloper.name
        ? { id: task.assignedDeveloper._id.toString(), name: task.assignedDeveloper.name }
        : null,
  };
}

// Get all tasks (supports project_id, assigned_to, priority, is_completed, search query filters)
tasksRouter.get("/", authenticate, async (req, res) => {
  try {
    const { project_id, assigned_to, priority, is_completed, search } = req.query;
    const filter: Record<string, any> = {};

    if (project_id && isValidObjectId(project_id as string)) {
      filter.project = project_id;
    }
    if (assigned_to && isValidObjectId(assigned_to as string)) {
      filter.assignedDeveloper = assigned_to;
    }
    if (priority && typeof priority === "string") {
      filter.priority = priority;
    }
    if (is_completed !== undefined) {
      filter.isCompleted = is_completed === "true";
    }
    if (search && typeof search === "string" && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const tasks = await Task.find(filter)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email")
      .sort({ deadline: 1 });

    res.json(tasks.map(formatTask));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// Get single task by ID
tasksRouter.get("/:id", authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const task = await Task.findById(req.params.id)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json(formatTask(task));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch task" });
  }
});

// Create task (Manager only)
tasksRouter.post("/", authenticate, requireRole("manager"), async (req: AuthRequest, res) => {
  try {
    const { project_id, title, description, assigned_developer_id, deadline, priority } = req.body;

    if (!project_id || !title || title.trim().length < 3) {
      res.status(400).json({ message: "Project and task title (min 3 chars) are required" });
      return;
    }

    const project = await Project.findById(project_id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const task = await Task.create({
      project: project_id,
      title: title.trim(),
      description: (description || "").trim(),
      assignedDeveloper: assigned_developer_id || null,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || "medium",
    });

    // Record activity
    await Activity.create({
      project: project._id,
      task: task._id,
      actor: req.user!.id,
      message: `created task ${task.title}`,
    });

    // Notify assigned developer if specified
    if (task.assignedDeveloper) {
      await Notification.create({
        recipient: task.assignedDeveloper,
        kind: "task_assigned",
        title: "New task assigned",
        body: task.title,
        task: task._id,
        project: project._id,
      });
    }

    const populated = await Task.findById(task._id)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");

    res.status(201).json(formatTask(populated));
  } catch (error) {
    console.error("[Tasks] Create error:", error);
    res.status(500).json({ message: "Failed to create task" });
  }
});

// Update / Reassign task (Manager or Assigned Developer)
tasksRouter.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const isManager = req.user!.role === "manager";
    const isAssignee = task.assignedDeveloper?.toString() === req.user!.id;

    if (!isManager && !isAssignee) {
      res.status(403).json({ message: "Not authorized to update this task" });
      return;
    }

    const { title, description, assigned_developer_id, deadline, priority, is_completed } =
      req.body;

    const previousAssignee = task.assignedDeveloper?.toString();

    // Managers can update all fields
    if (isManager) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description.trim();
      if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
      if (priority !== undefined) task.priority = priority;
      if (assigned_developer_id !== undefined) {
        task.assignedDeveloper = assigned_developer_id || null;
      }
    }

    // Both manager and assignee can toggle completion
    if (is_completed !== undefined) {
      task.isCompleted = Boolean(is_completed);
      task.completedAt = task.isCompleted ? new Date() : null;
    }

    await task.save();

    // Activity log
    await Activity.create({
      project: task.project,
      task: task._id,
      actor: req.user!.id,
      message: `updated task ${task.title}`,
    });

    // Notify new developer if assignment changed
    if (
      isManager &&
      task.assignedDeveloper &&
      task.assignedDeveloper.toString() !== previousAssignee
    ) {
      await Notification.create({
        recipient: task.assignedDeveloper,
        kind: "task_assigned",
        title: "New task assigned",
        body: task.title,
        task: task._id,
        project: task.project,
      });
    }

    const populated = await Task.findById(task._id)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");

    res.json(formatTask(populated));
  } catch (error) {
    res.status(500).json({ message: "Failed to update task" });
  }
});

// Toggle completion specifically
tasksRouter.patch("/:id/complete", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const { completed } = req.body;
    const isCompleted = Boolean(completed);

    task.isCompleted = isCompleted;
    task.completedAt = isCompleted ? new Date() : null;
    await task.save();

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: req.user!.id,
      message: `${isCompleted ? "completed" : "reopened"} ${task.title}`,
    });

    const populated = await Task.findById(task._id)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");

    res.json(formatTask(populated));
  } catch (error) {
    res.status(500).json({ message: "Failed to update task status" });
  }
});

// Delete task (Manager only)
tasksRouter.delete("/:id", authenticate, requireRole("manager"), async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    // Cascade delete subtasks, comments, activity, notifications for this task
    await Subtask.deleteMany({ task: task._id });
    await Comment.deleteMany({ task: task._id });
    await Activity.deleteMany({ task: task._id });
    await Notification.deleteMany({ task: task._id });

    await task.deleteOne();

    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete task" });
  }
});
