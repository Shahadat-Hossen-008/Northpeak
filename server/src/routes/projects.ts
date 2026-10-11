import { Router } from "express";
import mongoose, { isValidObjectId } from "mongoose";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { getProjectEligibleDevelopers, concurrencyTestBarriers } from "../services/team.js";

export const projectsRouter = Router();

function formatProject(p: any) {
  return {
    id: p._id.toString(),
    title: p.title,
    description: p.description,
    manager_id: p.manager ? p.manager.toString() : null,
    team: Array.isArray(p.team) ? p.team.map((id: any) => id.toString()) : [],
    start_date: p.startDate ? p.startDate.toISOString() : null,
    deadline: p.deadline ? p.deadline.toISOString() : null,
    priority: p.priority,
    created_at: p.createdAt.toISOString(),
  };
}

async function validateTeamDeveloperIds(
  team: any,
): Promise<{ valid: boolean; devIds: mongoose.Types.ObjectId[]; error?: string }> {
  if (!Array.isArray(team)) {
    return { valid: false, devIds: [], error: "Team must be an array of developer IDs" };
  }
  const uniqueIds = [
    ...new Set(team.map((id) => (typeof id === "string" ? id.trim() : String(id)))),
  ];
  for (const id of uniqueIds) {
    if (!isValidObjectId(id)) {
      return { valid: false, devIds: [], error: `Invalid developer ID: ${id}` };
    }
  }
  if (uniqueIds.length === 0) {
    return { valid: true, devIds: [] };
  }
  const devUsers = await User.find({ _id: { $in: uniqueIds }, role: "developer" }).select("_id");
  if (devUsers.length !== uniqueIds.length) {
    return { valid: false, devIds: [], error: "All team members must be registered developers" };
  }
  return { valid: true, devIds: devUsers.map((u) => u._id) };
}

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
    res.json(projects.map(formatProject));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// Get single project by ID
projectsRouter.get("/:id", authenticate, async (req, res) => {
  try {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    let project = null;
    if (isValidObjectId(rawId)) {
      project = await Project.findById(rawId);
    }

    if (!project) {
      const target = rawId.toLowerCase().trim();
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

    res.json(formatProject(project));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// Get eligible engineering team members for a project
projectsRouter.get("/:id/members", authenticate, async (req, res) => {
  try {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    let project = null;
    if (isValidObjectId(rawId)) {
      project = await Project.findById(rawId);
    }

    if (!project) {
      const target = rawId.toLowerCase().trim();
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
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch project members" });
  }
});

// Create project (Manager only)
projectsRouter.post("/", authenticate, requireRole("manager"), async (req: AuthRequest, res) => {
  try {
    const { title, description, start_date, deadline, priority, team } = req.body;

    if (!title || title.trim().length < 3) {
      res.status(400).json({ message: "Project title must be at least 3 characters" });
      return;
    }

    let teamIds: mongoose.Types.ObjectId[] = [];
    if (team !== undefined) {
      const validation = await validateTeamDeveloperIds(team);
      if (!validation.valid) {
        res.status(400).json({ message: validation.error });
        return;
      }
      teamIds = validation.devIds;
    }

    const project = await Project.create({
      title: title.trim(),
      description: (description || "").trim(),
      manager: req.user!.id,
      team: teamIds,
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

    res.status(201).json(formatProject(project));
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

      // Authorization boundary: Only the authorized project manager can modify this project
      if (project.manager.toString() !== req.user!.id) {
        res.status(403).json({ message: "Not authorized to modify this project" });
        return;
      }

      const { title, description, start_date, deadline, priority, team } = req.body;

      if (title !== undefined) project.title = title.trim();
      if (description !== undefined) project.description = description.trim();
      if (start_date !== undefined) project.startDate = start_date ? new Date(start_date) : null;
      if (deadline !== undefined) project.deadline = deadline ? new Date(deadline) : null;
      if (priority !== undefined) project.priority = priority;

      let unassignedTasksCount = 0;

      if (team !== undefined) {
        const validation = await validateTeamDeveloperIds(team);
        if (!validation.valid) {
          res.status(400).json({ message: validation.error });
          return;
        }

        const oldTeamIds = (project.team || []).map((id: any) => id.toString());
        const newTeamIdStrings = validation.devIds.map((id) => id.toString());
        const removedDevIds = oldTeamIds.filter((id) => !newTeamIdStrings.includes(id));

        project.team = validation.devIds;

        // Transactional execution ensuring atomic team modification and open task unassignments
        let session: mongoose.ClientSession | null = null;
        try {
          if (concurrencyTestBarriers.beforeProjectSave) {
            await concurrencyTestBarriers.beforeProjectSave();
          }

          session = await mongoose.startSession();
          session.startTransaction();

          await project.save({ session });

          if (concurrencyTestBarriers.duringProjectTeamRemoval) {
            await concurrencyTestBarriers.duringProjectTeamRemoval();
          }

          if (removedDevIds.length > 0) {
            if (concurrencyTestBarriers.simulateRemovalFailure) {
              throw new Error("Simulated database failure during bulk task unassignment");
            }
            const updateResult = await Task.updateMany(
              {
                project: project._id,
                assignedDeveloper: { $in: removedDevIds },
                isCompleted: false,
              },
              { $set: { assignedDeveloper: null } },
              { session },
            );
            unassignedTasksCount = updateResult.modifiedCount || 0;
          }

          await session.commitTransaction();

          // Post-commit sweep: ensures any task created concurrently during transaction snapshot is unassigned
          if (removedDevIds.length > 0) {
            const postSweep = await Task.updateMany(
              {
                project: project._id,
                assignedDeveloper: { $in: removedDevIds },
                isCompleted: false,
              },
              { $set: { assignedDeveloper: null } },
            );
            unassignedTasksCount += postSweep.modifiedCount || 0;
          }
        } catch (err: any) {
          if (session && session.inTransaction()) {
            await session.abortTransaction();
          }
          if (err?.message?.includes("Transaction numbers are only allowed")) {
            // Standalone fallback with compensating rollback
            await project.save();

            if (concurrencyTestBarriers.duringProjectTeamRemoval) {
              await concurrencyTestBarriers.duringProjectTeamRemoval();
            }

            if (removedDevIds.length > 0) {
              try {
                if (concurrencyTestBarriers.simulateRemovalFailure) {
                  throw new Error("Simulated database failure during bulk task unassignment");
                }
                const updateResult = await Task.updateMany(
                  {
                    project: project._id,
                    assignedDeveloper: { $in: removedDevIds },
                    isCompleted: false,
                  },
                  { $set: { assignedDeveloper: null } },
                );
                unassignedTasksCount = updateResult.modifiedCount || 0;
              } catch (updateErr) {
                project.team = oldTeamIds.map((id) => new mongoose.Types.ObjectId(id));
                await project.save();
                throw updateErr;
              }
            }
          } else {
            throw err;
          }
        } finally {
          if (session) {
            await session.endSession();
          }
        }
      } else {
        await project.save();
      }

      await Activity.create({
        project: project._id,
        actor: req.user!.id,
        message: `updated project details for ${project.title}`,
      });

      res.json({
        ...formatProject(project),
        unassigned_open_tasks_count: unassignedTasksCount,
      });
    } catch (error: any) {
      if (
        error?.name === "VersionError" ||
        error?.codeName === "WriteConflict" ||
        error?.code === 112
      ) {
        res.status(409).json({
          message:
            "Project was modified by another concurrent request. Please reload and try again.",
        });
        return;
      }
      console.error("[Projects] Update error:", error);
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

      // Authorization boundary: Only the authorized project manager can delete this project
      if (project.manager.toString() !== req.user!.id) {
        res.status(403).json({ message: "Not authorized to delete this project" });
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
