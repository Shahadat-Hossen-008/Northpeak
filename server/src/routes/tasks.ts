import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { isDeveloperInProjectTeam, concurrencyTestBarriers } from "../services/team.js";

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
    status: (task.status as string) || (task.isCompleted ? "done" : "todo"),
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

// Get all tasks (supports project_id/projectId, assigned_to/assignedTo, priority, status, is_completed, search query filters)
tasksRouter.get("/", authenticate, async (req, res) => {
  try {
    const {
      project_id,
      projectId,
      assigned_to,
      assignedTo,
      priority,
      status,
      is_completed,
      search,
    } = req.query;
    const filter: Record<string, any> = {};

    const targetProjectId = (project_id || projectId) as string;
    if (targetProjectId && isValidObjectId(targetProjectId)) {
      filter.project = targetProjectId;
    }
    const targetAssignedTo = (assigned_to || assignedTo) as string;
    if (targetAssignedTo && isValidObjectId(targetAssignedTo)) {
      filter.assignedDeveloper = targetAssignedTo;
    }
    if (priority && typeof priority === "string") {
      filter.priority = priority;
    }
    if (status && typeof status === "string") {
      filter.status = status;
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
    const { project_id, title, description, assigned_developer_id, deadline, priority, status } =
      req.body;

    if (!project_id || !title || title.trim().length < 3) {
      res.status(400).json({ message: "Project and task title (min 3 chars) are required" });
      return;
    }

    if (!isValidObjectId(project_id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const project = await Project.findById(project_id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Authorization boundary: Only the authorized project manager can create tasks for this project
    if (project.manager.toString() !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to create tasks for this project" });
      return;
    }

    let assignedDevId: string | null = null;
    if (assigned_developer_id && assigned_developer_id !== "unassigned") {
      if (!isValidObjectId(assigned_developer_id)) {
        res.status(400).json({ message: "Invalid developer ID" });
        return;
      }

      const devUser = await User.findById(assigned_developer_id);
      if (!devUser) {
        res.status(404).json({ message: "Developer not found" });
        return;
      }

      if (devUser.role !== "developer") {
        res.status(400).json({ message: "Assigned user must have developer role" });
        return;
      }

      // Atomic project-team membership check coordinated with the project document
      const projectWithMember = await Project.findOneAndUpdate(
        {
          _id: project._id,
          team: devUser._id,
        },
        { $set: { updatedAt: new Date() } },
        { new: true },
      );

      if (!projectWithMember) {
        res.status(400).json({
          message: "Developer does not belong to the selected project's engineering team",
        });
        return;
      }

      assignedDevId = devUser._id.toString();
    }

    const task = await Task.create({
      project: project._id,
      title: title.trim(),
      description: (description || "").trim(),
      assignedDeveloper: assignedDevId,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || "medium",
      status:
        status && ["todo", "in_progress", "in_review", "done"].includes(status) ? status : "todo",
      isCompleted: status === "done",
      completedAt: status === "done" ? new Date() : null,
    });

    if (concurrencyTestBarriers.afterTaskCreateSave) {
      await concurrencyTestBarriers.afterTaskCreateSave();
    }

    // Concurrency guard: verify that assigned developer was not removed during task creation
    if (assignedDevId) {
      const currentProject = await Project.findById(project._id).select("team");
      const isStillMember = currentProject?.team?.some((id) => id.toString() === assignedDevId);
      if (!isStillMember) {
        await Task.findByIdAndDelete(task._id);
        res.status(400).json({
          message: "Developer does not belong to the selected project's engineering team",
        });
        return;
      }
    }

    if (concurrencyTestBarriers.afterTaskCreateMembershipCheck) {
      await concurrencyTestBarriers.afterTaskCreateMembershipCheck();
    }

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

    const project = await Project.findById(task.project);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Authorization boundary: Manager must be the manager of this project
    if (isManager && project.manager.toString() !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to manage tasks for this project" });
      return;
    }

    const { title, description, assigned_developer_id, deadline, priority, is_completed, status } =
      req.body;

    const previousAssignee = task.assignedDeveloper?.toString();
    const previousStatus = task.status;

    let assignedDevUser: any = null;
    // Check developer reassignment authorization & project team membership
    if (assigned_developer_id !== undefined) {
      if (!isManager) {
        res.status(403).json({ message: "Not authorized to reassign this task" });
        return;
      }

      if (!assigned_developer_id || assigned_developer_id === "unassigned") {
        task.assignedDeveloper = null;
      } else {
        if (!isValidObjectId(assigned_developer_id)) {
          res.status(400).json({ message: "Invalid developer ID" });
          return;
        }

        const devUser = await User.findById(assigned_developer_id);
        if (!devUser) {
          res.status(404).json({ message: "Developer not found" });
          return;
        }

        if (devUser.role !== "developer") {
          res.status(400).json({ message: "Assigned user must have developer role" });
          return;
        }

        // Atomic project-team membership check coordinated with the project document
        const projectWithMember = await Project.findOneAndUpdate(
          {
            _id: task.project,
            team: devUser._id,
          },
          { $set: { updatedAt: new Date() } },
          { new: true },
        );

        if (!projectWithMember) {
          res.status(400).json({
            message: "Developer does not belong to the selected project's engineering team",
          });
          return;
        }

        task.assignedDeveloper = devUser._id;
        assignedDevUser = devUser;
      }
    }

    // Managers can update all other task fields
    if (isManager) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description.trim();
      if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
      if (priority !== undefined) task.priority = priority;
    }

    // Both manager and assignee can update workflow status
    if (status !== undefined && ["todo", "in_progress", "in_review", "done"].includes(status)) {
      task.status = status;
      if (status === "done") {
        task.isCompleted = true;
        if (!task.completedAt) task.completedAt = new Date();
      } else {
        task.isCompleted = false;
        task.completedAt = null;
      }
    } else if (is_completed !== undefined) {
      task.isCompleted = Boolean(is_completed);
      task.completedAt = task.isCompleted ? new Date() : null;
      task.status = task.isCompleted ? "done" : "todo";
    }

    await task.save();

    if (concurrencyTestBarriers.afterTaskPatchSave) {
      await concurrencyTestBarriers.afterTaskPatchSave();
    }

    // Concurrency guard: verify that assigned developer was not concurrently removed from project team
    if (assignedDevUser) {
      const currentProject = await Project.findById(task.project).select("team");
      const isStillMember = currentProject?.team?.some(
        (id) => id.toString() === assignedDevUser._id.toString(),
      );
      if (!isStillMember) {
        task.assignedDeveloper = null;
        await task.save();
        res.status(400).json({
          message: "Developer does not belong to the selected project's engineering team",
        });
        return;
      }
    }

    if (concurrencyTestBarriers.afterTaskPatchMembershipCheck) {
      await concurrencyTestBarriers.afterTaskPatchMembershipCheck();
    }

    // Activity log
    const activityMsg =
      status !== undefined && status !== previousStatus
        ? `moved ${task.title} to ${status.replace("_", " ")}`
        : `updated task ${task.title}`;

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: req.user!.id,
      message: activityMsg,
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

    const project = await Project.findById(task.project);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const isManager = req.user!.role === "manager";
    const isProjectManager = isManager && project.manager.toString() === req.user!.id;
    const isAssignee = task.assignedDeveloper?.toString() === req.user!.id;

    if (!isProjectManager && !isAssignee) {
      res.status(403).json({ message: "Not authorized to update this task" });
      return;
    }

    const { completed } = req.body;
    const isCompleted = Boolean(completed);

    task.isCompleted = isCompleted;
    task.completedAt = isCompleted ? new Date() : null;
    task.status = isCompleted ? "done" : "todo";
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

    const project = await Project.findById(task.project);
    if (!project || project.manager.toString() !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to delete tasks for this project" });
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
