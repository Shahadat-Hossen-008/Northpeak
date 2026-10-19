import { config } from "../config/env.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Project, type IProject } from "../models/Project.js";
import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../middleware/error.js";
import { escapeRegex, slugify } from "../lib/utils.js";
import { reconcileAssignmentsSafely } from "./reconcile.service.js";
import { getProjectEligibleDevelopers, concurrencyTestBarriers } from "./team.js";
import {
  serializeProject,
  serializeProjectMember,
  type SerializedProject,
  type SerializedProjectMember,
} from "../serializers/project.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";
import { canReadProject } from "./task-access.js";

export interface CreateProjectInput {
  title?: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  priority?: any;
  team?: any[];
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  start_date?: string | null;
  deadline?: string | null;
  priority?: any;
  team?: any[];
}

export class ProjectService {
  async validateTeamDeveloperIds(
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

  private async syncRemovedTeamTaskAssignments(
    projectId: mongoose.Types.ObjectId | string,
    removedDevIds: string[],
    session?: mongoose.ClientSession,
  ): Promise<number> {
    if (removedDevIds.length === 0) return 0;
    if (concurrencyTestBarriers.simulateRemovalFailure) {
      throw new Error("Simulated database failure during bulk task unassignment");
    }
    const updateResult = await Task.updateMany(
      {
        project: projectId,
        assignedDeveloper: { $in: removedDevIds },
        isCompleted: false,
      },
      { $set: { assignedDeveloper: null, assignedBy: null } },
      session ? { session } : undefined,
    );
    const projectTasksQuery = Task.find({ project: projectId }).select("_id");
    if (session) projectTasksQuery.session(session);
    const projectTaskIds = await projectTasksQuery;
    await Subtask.updateMany(
      {
        task: { $in: projectTaskIds.map((task) => task._id) },
        assignedDeveloper: { $in: removedDevIds },
        isCompleted: false,
      },
      { $set: { assignedDeveloper: null } },
      session ? { session } : undefined,
    );
    return updateResult.modifiedCount || 0;
  }

  async getProjects(
    user: AuthUserPayload,
    query: { search?: any; priority?: any },
  ): Promise<SerializedProject[]> {
    const { search, priority } = query;
    let accessFilter: Record<string, any>;
    if (user.role === "manager") {
      accessFilter = { manager: user.id };
    } else if (user.role === "developer") {
      const assignedProjectIds = await Task.find({ assignedDeveloper: user.id }).distinct(
        "project",
      );
      accessFilter = { $or: [{ team: user.id }, { _id: { $in: assignedProjectIds } }] };
    } else {
      throw new AppError("Not authorized to read projects", 403);
    }

    const filter: Record<string, any> = { $and: [accessFilter] };
    if (priority && typeof priority === "string") {
      filter.priority = priority;
    }

    if (search && typeof search === "string" && search.trim()) {
      const escaped = escapeRegex(search.trim());
      const searchFilter = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ];
      filter.$and.push({ $or: searchFilter });
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    return projects.map(serializeProject);
  }

  async getProjectByIdOrSlug(idOrSlug: string): Promise<IProject> {
    const rawId = idOrSlug.trim();
    let project: IProject | null = null;

    if (isValidObjectId(rawId)) {
      project = await Project.findById(rawId);
    }

    if (!project) {
      const target = rawId.toLowerCase();
      // Lean projection scan to prevent memory exhaustion / DoS
      const allProjects = await Project.find({}, "_id title");
      const matches = allProjects.filter((p) => {
        const slug = slugify(p.title);
        return slug === target || p.title.toLowerCase() === target;
      });

      if (matches.length > 1) throw new AppError("Project not found", 404);
      if (matches.length === 1) project = await Project.findById(matches[0]._id);
    }

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    return project;
  }

  async getProjectDetails(idOrSlug: string, user: AuthUserPayload): Promise<SerializedProject> {
    const project = await this.getProjectByIdOrSlug(idOrSlug);
    if (!(await canReadProject(project._id, user))) throw new AppError("Project not found", 404);
    return serializeProject(project);
  }

  async getProjectMembers(
    idOrSlug: string,
    user: AuthUserPayload,
  ): Promise<SerializedProjectMember[]> {
    const project = await this.getProjectByIdOrSlug(idOrSlug);
    const allowed =
      user.role === "manager"
        ? project.manager.toString() === user.id
        : user.role === "developer" && project.team.some((member) => member.toString() === user.id);
    if (!allowed) throw new AppError("Project not found", 404);
    const eligibleDevs = await getProjectEligibleDevelopers(project._id);
    return eligibleDevs.map(serializeProjectMember);
  }

  async createProject(managerId: string, input: CreateProjectInput): Promise<SerializedProject> {
    const { title, description, start_date, deadline, priority, team } = input;

    if (!title || title.trim().length < 3) {
      throw new AppError("Project title must be at least 3 characters", 400);
    }

    let teamIds: mongoose.Types.ObjectId[] = [];
    if (team !== undefined) {
      const validation = await this.validateTeamDeveloperIds(team);
      if (!validation.valid) {
        throw new AppError(validation.error || "Invalid team developer IDs", 400);
      }
      teamIds = validation.devIds;
    }

    const project = await Project.create({
      title: title.trim(),
      description: (description || "").trim(),
      manager: managerId,
      team: teamIds,
      startDate: start_date ? new Date(start_date) : null,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || "medium",
    });

    // Record activity
    await Activity.create({
      project: project._id,
      actor: managerId,
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

    return serializeProject(project);
  }

  async updateProject(
    projectId: string,
    user: AuthUserPayload,
    input: UpdateProjectInput,
  ): Promise<SerializedProject> {
    if (!isValidObjectId(projectId)) {
      throw new AppError("Project not found", 404);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization boundary: Only the assigned project manager can modify this project
    if (project.manager.toString() !== user.id) {
      throw new AppError("Not authorized to modify this project", 403);
    }

    const { title, description, start_date, deadline, priority, team } = input;

    if (title !== undefined) project.title = title.trim();
    if (description !== undefined) project.description = description.trim();
    if (start_date !== undefined) project.startDate = start_date ? new Date(start_date) : null;
    if (deadline !== undefined) project.deadline = deadline ? new Date(deadline) : null;
    if (priority !== undefined) project.priority = priority;

    let unassignedTasksCount = 0;
    let reconciliationPending = false;

    if (team !== undefined) {
      const validation = await this.validateTeamDeveloperIds(team);
      if (!validation.valid) {
        throw new AppError(validation.error || "Invalid team developer IDs", 400);
      }

      const oldTeamIds = (project.team || []).map((id: any) => id.toString());
      const newTeamIdStrings = validation.devIds.map((id) => id.toString());
      const removedDevIds = oldTeamIds.filter((id) => !newTeamIdStrings.includes(id));

      project.team = validation.devIds;

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
          unassignedTasksCount = await this.syncRemovedTeamTaskAssignments(
            project._id,
            removedDevIds,
            session,
          );
        }

        await session.commitTransaction();

        // Post-commit reconciliation: repairs open task/subtask assignments created concurrently
        // with the transaction snapshot. Failure is non-fatal (the removal is committed) but is
        // surfaced to the caller and retried by the periodic reconciler.
        if (removedDevIds.length > 0) {
          const swept = await reconcileAssignmentsSafely({ projectId: project._id });
          if (swept.ok) {
            unassignedTasksCount += swept.result?.tasks ?? 0;
          } else {
            reconciliationPending = true;
          }
        }
      } catch (err: any) {
        if (session && session.inTransaction()) {
          await session.abortTransaction();
        }
        if (
          err?.message?.includes("Transaction numbers are only allowed") &&
          config.NODE_ENV === "production"
        ) {
          // Production must run on a replica set / Atlas cluster. Never silently degrade to
          // non-atomic team removal; surface a clear, non-sensitive failure instead.
          console.error(
            JSON.stringify({
              level: "error",
              message: "MongoDB transactions unavailable: production requires a replica set",
              projectId: project._id.toString(),
            }),
          );
          throw new AppError(
            "Project team update is temporarily unavailable. Please try again later.",
            503,
          );
        }
        if (err?.message?.includes("Transaction numbers are only allowed")) {
          // Standalone MongoDB fallback with compensating rollback (development/test only)
          await project.save();

          if (concurrencyTestBarriers.duringProjectTeamRemoval) {
            await concurrencyTestBarriers.duringProjectTeamRemoval();
          }

          if (removedDevIds.length > 0) {
            try {
              unassignedTasksCount = await this.syncRemovedTeamTaskAssignments(
                project._id,
                removedDevIds,
              );
            } catch (updateErr) {
              project.team = oldTeamIds.map((id) => new mongoose.Types.ObjectId(id));
              await project.save();
              throw updateErr;
            }
          }
        } else {
          if (
            err?.name === "VersionError" ||
            err?.codeName === "WriteConflict" ||
            err?.code === 112
          ) {
            throw new AppError(
              "Project was modified by another concurrent request. Please reload and try again.",
              409,
            );
          }
          throw err;
        }
      } finally {
        if (session) {
          await session.endSession();
        }
      }
    } else {
      try {
        await project.save();
      } catch (err: any) {
        if (
          err?.name === "VersionError" ||
          err?.codeName === "WriteConflict" ||
          err?.code === 112
        ) {
          throw new AppError(
            "Project was modified by another concurrent request. Please reload and try again.",
            409,
          );
        }
        throw err;
      }
    }

    await Activity.create({
      project: project._id,
      actor: user.id,
      message: `updated project details for ${project.title}`,
    });

    const serialized = serializeProject(project);
    return {
      ...serialized,
      unassigned_open_tasks_count: unassignedTasksCount,
      ...(reconciliationPending ? { assignment_reconciliation_pending: true } : {}),
    };
  }

  async deleteProject(
    projectId: string,
    user: AuthUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(projectId)) {
      throw new AppError("Project not found", 404);
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization boundary: Only the authorized project manager can delete this project
    if (project.manager.toString() !== user.id) {
      throw new AppError("Not authorized to delete this project", 403);
    }

    const tasks = await Task.find({ project: project._id }).select("_id");
    const taskIds = tasks.map((t) => t._id);

    // Cascade delete related entities
    await Subtask.deleteMany({ task: { $in: taskIds } });
    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ _id: { $in: taskIds } });
    await Activity.deleteMany({ project: project._id });
    await Notification.deleteMany({ project: project._id });
    await project.deleteOne();

    return {
      success: true,
      message: `Project ${project.title} and related items deleted`,
    };
  }
}

export const projectService = new ProjectService();
