import { isValidObjectId } from "mongoose";
import { User, type IUser } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Subtask } from "../models/Subtask.js";
import { Project } from "../models/Project.js";
import { AppError } from "../middleware/error.js";
import { getProjectEligibleDevelopers } from "./team.js";
import {
  serializeMember,
  type SerializedMember,
  type SerializedMemberWorkload,
  type MemberWorkloadTask,
} from "../serializers/member.serializer.js";

export class MemberService {
  async getMembers(rawProjectId?: string): Promise<SerializedMember[]> {
    if (rawProjectId !== undefined) {
      let project = null;
      if (isValidObjectId(rawProjectId)) {
        project = await Project.findById(rawProjectId);
      }

      if (!project) {
        const target = rawProjectId.toLowerCase().trim();
        // Lean projection scan
        const allProjects = await Project.find({}, "_id title");
        const match = allProjects.find((p) => {
          const slug = p.title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
          return slug === target || p.title.toLowerCase() === target;
        });

        if (match) {
          project = await Project.findById(match._id);
        }
      }

      if (!project) {
        throw new AppError("Project not found", 404);
      }

      const eligibleDevs = await getProjectEligibleDevelopers(project._id);
      return eligibleDevs.map(serializeMember);
    }

    const users = await User.find().select("name email role createdAt").sort({ name: 1 });
    return users.map(serializeMember);
  }

  async getMemberById(id: string): Promise<SerializedMember> {
    if (!isValidObjectId(id)) {
      throw new AppError("Invalid member ID", 400);
    }

    const user = await User.findById(id).select("name email role createdAt");
    if (!user) {
      throw new AppError("Member not found", 404);
    }

    return serializeMember(user);
  }

  async getMemberWorkload(id: string, projectId?: string): Promise<SerializedMemberWorkload> {
    if (!isValidObjectId(id)) {
      throw new AppError("Invalid member ID", 400);
    }

    const user = await User.findById(id).select("name email role createdAt");
    if (!user) {
      throw new AppError("Member not found", 404);
    }

    const taskFilter: Record<string, any> = { assignedDeveloper: id };
    if (projectId && isValidObjectId(projectId)) {
      taskFilter.project = projectId;
    }

    const tasks = await Task.find(taskFilter)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email")
      .sort({ deadline: 1, createdAt: -1 });

    const taskIds = tasks.map((t) => t._id);
    const subtasks = await Subtask.find({ task: { $in: taskIds } });

    const now = new Date();
    const formattedTasks: MemberWorkloadTask[] = tasks.map((t) => {
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

    return {
      member: serializeMember(user),
      stats: {
        total: formattedTasks.length,
        active: activeTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        workload_percentage: workloadPercentage,
      },
      tasks: formattedTasks,
    };
  }
}

export const memberService = new MemberService();
