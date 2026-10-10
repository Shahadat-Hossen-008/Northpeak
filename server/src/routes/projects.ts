import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Project } from "../models/Project.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";

export const projectsRouter = Router();

// Get all projects (with optional search and priority filtering)
projectsRouter.get("/", authenticate, async (req, res) => {
  try {
    const { search, priority } = req.query;
    const filter: Record<string, any> = {};

    if (priority && typeof priority === "string") {
      filter.priority = priority;
    }

    if (search && typeof search === "string" && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    const formatted = projects.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      manager_id: p.manager.toString(),
      start_date: p.startDate ? p.startDate.toISOString() : null,
      deadline: p.deadline ? p.deadline.toISOString() : null,
      priority: p.priority,
      created_at: p.createdAt.toISOString(),
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// Get single project by ID
projectsRouter.get("/:id", authenticate, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({
      id: project._id.toString(),
      title: project.title,
      description: project.description,
      manager_id: project.manager.toString(),
      start_date: project.startDate ? project.startDate.toISOString() : null,
      deadline: project.deadline ? project.deadline.toISOString() : null,
      priority: project.priority,
      created_at: project.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// Create project (Manager only)
projectsRouter.post("/", authenticate, requireRole("manager"), async (req: AuthRequest, res) => {
  try {
    const { title, description, start_date, deadline, priority } = req.body;

    if (!title || title.trim().length < 3) {
      res.status(400).json({ message: "Project title must be at least 3 characters" });
      return;
    }

    const project = await Project.create({
      title: title.trim(),
      description: (description || "").trim(),
      manager: req.user!.id,
      startDate: start_date ? new Date(start_date) : null,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || "medium",
    });

    // Record activity
    await Activity.create({
      project: project._id,
      actor: req.user!.id,
      message: `created project ${project.title}`,
    });

    // Broadcast manager notification
    await Notification.create({
      audience: "manager",
      kind: "project_created",
      title: "Project created",
      body: `${project.title} was created.`,
      project: project._id,
    });

    res.status(201).json({
      id: project._id.toString(),
      title: project.title,
      description: project.description,
      manager_id: project.manager.toString(),
      start_date: project.startDate ? project.startDate.toISOString() : null,
      deadline: project.deadline ? project.deadline.toISOString() : null,
      priority: project.priority,
      created_at: project.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[Projects] Create error:", error);
    res.status(500).json({ message: "Failed to create project" });
  }
});

// Update project (Manager only)
projectsRouter.patch(
  "/:id",
  authenticate,
  requireRole("manager"),
  async (req: AuthRequest, res) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const project = await Project.findById(req.params.id);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const { title, description, start_date, deadline, priority } = req.body;

      if (title !== undefined) project.title = title.trim();
      if (description !== undefined) project.description = description.trim();
      if (start_date !== undefined) project.startDate = start_date ? new Date(start_date) : null;
      if (deadline !== undefined) project.deadline = deadline ? new Date(deadline) : null;
      if (priority !== undefined) project.priority = priority;

      await project.save();

      await Activity.create({
        project: project._id,
        actor: req.user!.id,
        message: `updated project details for ${project.title}`,
      });

      res.json({
        id: project._id.toString(),
        title: project.title,
        description: project.description,
        manager_id: project.manager.toString(),
        start_date: project.startDate ? project.startDate.toISOString() : null,
        deadline: project.deadline ? project.deadline.toISOString() : null,
        priority: project.priority,
        created_at: project.createdAt.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update project" });
    }
  },
);

// Delete project (Manager only) — Cascades to tasks, subtasks, comments, activities
projectsRouter.delete(
  "/:id",
  authenticate,
  requireRole("manager"),
  async (req: AuthRequest, res) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const project = await Project.findById(req.params.id);
      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      // Find all tasks belonging to this project
      const tasks = await Task.find({ project: project._id }).select("_id");
      const taskIds = tasks.map((t) => t._id);

      // Cascade delete subtasks and comments for these tasks
      await Subtask.deleteMany({ task: { $in: taskIds } });
      await Comment.deleteMany({ task: { $in: taskIds } });
      await Task.deleteMany({ _id: { $in: taskIds } });
      await Activity.deleteMany({ project: project._id });
      await Notification.deleteMany({ project: project._id });

      // Delete project
      await project.deleteOne();

      res.json({ success: true, message: `Project ${project.title} and related items deleted` });
    } catch (error) {
      console.error("[Projects] Delete error:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  },
);
