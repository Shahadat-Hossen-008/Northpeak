import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Project } from "../models/Project.js";
import { authenticate } from "../middleware/auth.js";
import { getProjectEligibleDevelopers } from "../services/team.js";

export const membersRouter = Router();

// Get members (optionally filtered by projectId for assignment, or all workspace members)
membersRouter.get("/", authenticate, async (req, res) => {
  try {
    const rawProjectId = (req.query.projectId ?? req.query.project_id) as string | undefined;

    if (rawProjectId !== undefined) {
      let project = null;
      if (isValidObjectId(rawProjectId)) {
        project = await Project.findById(rawProjectId);
      }

      if (!project) {
        const target = rawProjectId.toLowerCase().trim();
        const all = await Project.find();
        project =
          all.find((p) => {
            const slug = p.title
              .toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s_-]+/g, "-")
              .replace(/^-+|-+$/g, "");
            return slug === target || p.title.toLowerCase() === target;
          }) ?? null;
      }

      if (!project) {
        res.status(404).json({ message: "Project not found" });
        return;
      }

      const eligibleDevs = await getProjectEligibleDevelopers(project._id);
      const formatted = eligibleDevs.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        created_at: u.createdAt.toISOString(),
      }));
      res.json(formatted);
      return;
    }

    const users = await User.find().select("name email role createdAt").sort({ name: 1 });
    const formatted = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.createdAt.toISOString(),
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

// Get single member profile
membersRouter.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }
    const user = await User.findById(id).select("name email role createdAt");
    if (!user) {
      return res.status(404).json({ message: "Member not found" });
    }
    res.json({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch member" });
  }
});

// Get member workload and assigned tasks breakdown
membersRouter.get("/:id/workload", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member ID" });
    }

    const user = await User.findById(id).select("name email role createdAt");
    if (!user) {
      return res.status(404).json({ message: "Member not found" });
    }

    const taskFilter: Record<string, any> = { assignedDeveloper: id };
    if (projectId && isValidObjectId(projectId as string)) {
      taskFilter.project = projectId;
    }

    const tasks = await Task.find(taskFilter)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email")
      .sort({ deadline: 1, createdAt: -1 });

    const taskIds = tasks.map((t) => t._id);
    const subtasks = await Subtask.find({ task: { $in: taskIds } });

    const now = new Date();
    const formattedTasks = tasks.map((t) => {
      const taskSubs = subtasks.filter((s) => s.task.toString() === t._id.toString());
      const completedSubs = taskSubs.filter((s) => s.isCompleted).length;

      let status = "no_deadline";
      if (t.isCompleted) {
        if (!t.deadline) {
          status = "completed_on_time";
        } else {
          const done = t.completedAt ? new Date(t.completedAt) : now;
          status =
            done.getTime() > new Date(t.deadline).getTime()
              ? "completed_late"
              : "completed_on_time";
        }
      } else if (t.deadline) {
        const deadlineDate = new Date(t.deadline);
        const diff = deadlineDate.getTime() - now.getTime();
        if (diff < 0) {
          status = "overdue";
        } else if (diff <= 3 * 86_400_000) {
          status = "due_soon";
        } else {
          status = "on_track";
        }
      }

      return {
        id: t._id.toString(),
        project_id: t.project?._id ? t.project._id.toString() : t.project?.toString() || "",
        title: t.title,
        description: t.description || "",
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
        priority: t.priority,
        is_completed: Boolean(t.isCompleted),
        completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
        created_at: t.createdAt.toISOString(),
        status,
        workflow_status: (t.status as string) || (t.isCompleted ? "done" : "todo"),
        project:
          t.project && typeof t.project === "object" && (t.project as any).title
            ? { id: (t.project as any)._id.toString(), title: (t.project as any).title }
            : null,
        subtasks_count: taskSubs.length,
        subtasks_completed_count: completedSubs,
      };
    });

    const activeTasks = formattedTasks.filter((t) => !t.is_completed).length;
    const completedTasks = formattedTasks.filter((t) => t.is_completed).length;
    const overdueTasks = formattedTasks.filter((t) => t.status === "overdue").length;
    const workloadPercentage = Math.min(100, activeTasks * 20);

    res.json({
      member: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.createdAt.toISOString(),
      },
      stats: {
        total: formattedTasks.length,
        active: activeTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        workload_percentage: workloadPercentage,
      },
      tasks: formattedTasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch member workload" });
  }
});
