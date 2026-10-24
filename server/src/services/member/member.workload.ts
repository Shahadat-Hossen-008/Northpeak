// Member workload queries and response formatting.
// Re-exported through this folder's member.service.ts for the existing route-facing API.
// Read-only: this module does not write data or touch req/res.

import { isValidObjectId } from "mongoose";
import { User } from "../../models/User.js";
import { Task, type ITask } from "../../models/Task.js";
import { Subtask, type ISubtask } from "../../models/Subtask.js";
import { AppError } from "../../middleware/error.js";
import {
  serializeMember,
  type SerializedMemberWorkload,
  type MemberWorkloadTask,
} from "../../serializers/member.serializer.js";

const DUE_SOON_MS = 3 * 86_400_000;
const WORKLOAD_PER_ACTIVE_TASK = 20;
const MAX_WORKLOAD_PERCENTAGE = 100;

/**
 * Returns a member's profile, workload statistics, and assigned tasks.
 * An invalid projectId is ignored and all of the member's tasks are returned.
 * Who may call it: any authenticated user. Side effects: none.
 * Errors: 400 ("Invalid member ID") for an invalid ID; 404 ("Member not found") when absent.
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
  return buildWorkload(user, tasks, subtasks, new Date());
}

/** Builds workload statistics and serializes the selected tasks. */
function buildWorkload(
  user: NonNullable<Awaited<ReturnType<typeof User.findById>>>,
  tasks: ITask[],
  subtasks: ISubtask[],
  now: Date,
): SerializedMemberWorkload {
  const formattedTasks: MemberWorkloadTask[] = tasks.map((task) =>
    toWorkloadTask(task, subtasks, now),
  );
  const activeTasks = formattedTasks.filter((task) => !task.is_completed).length;
  const completedTasks = formattedTasks.filter((task) => task.is_completed).length;
  const overdueTasks = formattedTasks.filter((task) => task.status === "overdue").length;
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
  const taskSubs = subtasks.filter((subtask) => subtask.task.toString() === task._id.toString());
  const completedSubs = taskSubs.filter((subtask) => subtask.isCompleted).length;
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
  // Open tasks without a deadline remain "no_deadline".
  let status = "no_deadline";

  if (task.isCompleted) {
    // Completed tasks without deadlines count as on time; otherwise compare completion time with deadline.
    if (!task.deadline) {
      status = "completed_on_time";
    } else {
      const done = task.completedAt ? new Date(task.completedAt) : now;
      status =
        done.getTime() > new Date(task.deadline).getTime() ? "completed_late" : "completed_on_time";
    }
  } else if (task.deadline) {
    // Open tasks with deadlines are overdue, due soon within three days, or on track.
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
