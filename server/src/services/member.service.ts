// Member service: read-only member directory, profile lookup, and workload calculation.
// Called by routes/members.ts.
// Must not write data, trigger side effects, or touch req/res.

import { isValidObjectId } from "mongoose";
import { User } from "../models/User.js";
import { Task, type ITask } from "../models/Task.js";
import { Subtask, type ISubtask } from "../models/Subtask.js";
import { Project, type IProject } from "../models/Project.js";
import { AppError } from "../middleware/error.js";
import { getProjectEligibleDevelopers } from "./team.js";
import {
  serializeMember,
  type SerializedMember,
  type SerializedMemberWorkload,
  type MemberWorkloadTask,
} from "../serializers/member.serializer.js";

const DUE_SOON_MS = 3 * 86_400_000;
const WORKLOAD_PER_ACTIVE_TASK = 20;
const MAX_WORKLOAD_PERCENTAGE = 100;

/**
 * Returns workspace members or, when rawProjectId is provided, the eligible developers for that project.
 * Who may call it: any authenticated user.
 * Side effects: none (read-only).
 * Errors: 404 ("Project not found") if rawProjectId is provided and no matching project is found by ID, slug, or title.
 */
export async function getMembers(rawProjectId?: string): Promise<SerializedMember[]> {
  if (rawProjectId !== undefined) {
    const project = await findProject(rawProjectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const eligibleDevs = await getProjectEligibleDevelopers(project._id);
    return eligibleDevs.map(serializeMember);
  }

  const users = await User.find().select("name email role createdAt").sort({ name: 1 });
  return users.map(serializeMember);
}

/** Looks up a project by ObjectId first, then falls back to slug or case-insensitive title match. */
async function findProject(rawProjectId: string): Promise<IProject | null> {
  let project = null;
  if (isValidObjectId(rawProjectId)) {
    project = await Project.findById(rawProjectId);
  }

  // Fall back to slug or case-insensitive title match when rawProjectId is not a matching ObjectId
  if (!project) {
    const target = rawProjectId.toLowerCase().trim();
    // Loads only _id and title of every project to compare slugs
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

  return project;
}

/**
 * Returns a single member profile by user ID.
 * Who may call it: any authenticated user.
 * Side effects: none (read-only).
 * Errors: 400 ("Invalid member ID") if id is not a valid ObjectId;
 * 404 ("Member not found") if no user exists with that ID.
 */
export async function getMemberById(id: string): Promise<SerializedMember> {
  if (!isValidObjectId(id)) {
    throw new AppError("Invalid member ID", 400);
  }

  const user = await User.findById(id).select("name email role createdAt");
  if (!user) {
    throw new AppError("Member not found", 404);
  }

  return serializeMember(user);
}

/**
 * Returns a member's profile, task workload statistics, and assigned tasks (optionally filtered by projectId).
 * An invalid projectId is ignored and all of the member's tasks are returned.
 * Who may call it: any authenticated user.
 * Side effects: none (read-only).
 * Errors: 400 ("Invalid member ID") if id is not a valid ObjectId;
 * 404 ("Member not found") if no user exists with that ID.
 */
export async function getMemberWorkload(
  id: string,
  projectId?: string,
): Promise<SerializedMemberWorkload> {
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
  const formattedTasks: MemberWorkloadTask[] = tasks.map((t) => toWorkloadTask(t, subtasks, now));

  const activeTasks = formattedTasks.filter((t) => !t.is_completed).length;
  const completedTasks = formattedTasks.filter((t) => t.is_completed).length;
  const overdueTasks = formattedTasks.filter((t) => t.status === "overdue").length;
  const workloadPercentage = Math.min(
    MAX_WORKLOAD_PERCENTAGE,
    activeTasks * WORKLOAD_PER_ACTIVE_TASK,
  );

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

/** Formats a task document with its subtask counts and deadline status for the workload response. */
function toWorkloadTask(task: ITask, subtasks: ISubtask[], now: Date): MemberWorkloadTask {
  const taskSubs = subtasks.filter((s) => s.task.toString() === task._id.toString());
  const completedSubs = taskSubs.filter((s) => s.isCompleted).length;
  const status = getTaskStatus(task, now);

  return {
    id: task._id.toString(),
    project_id: task.project?._id ? task.project._id.toString() : task.project?.toString() || "",
    title: task.title,
    description: task.description || "",
    deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
    priority: task.priority,
    is_completed: Boolean(task.isCompleted),
    completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    created_at: task.createdAt.toISOString(),
    status,
    workflow_status: (task.status as string) || (task.isCompleted ? "done" : "todo"),
    project:
      task.project && typeof task.project === "object" && (task.project as any).title
        ? { id: (task.project as any)._id.toString(), title: (task.project as any).title }
        : null,
    subtasks_count: taskSubs.length,
    subtasks_completed_count: completedSubs,
  };
}

/** Computes a task's deadline status label relative to now. */
function getTaskStatus(task: ITask, now: Date): string {
  // Open tasks without a deadline remain "no_deadline"
  let status = "no_deadline";

  if (task.isCompleted) {
    // Completed tasks without a deadline count as completed on time; otherwise compare completion time to deadline
    if (!task.deadline) {
      status = "completed_on_time";
    } else {
      const done = task.completedAt ? new Date(task.completedAt) : now;
      status =
        done.getTime() > new Date(task.deadline).getTime() ? "completed_late" : "completed_on_time";
    }
  } else if (task.deadline) {
    // Open tasks with a deadline are overdue if past due, due_soon within 3 days, or on_track otherwise
    const deadlineDate = new Date(task.deadline);
    const diff = deadlineDate.getTime() - now.getTime();
    if (diff < 0) {
      status = "overdue";
    } else if (diff <= DUE_SOON_MS) {
      status = "due_soon";
    } else {
      status = "on_track";
    }
  }

  return status;
}
