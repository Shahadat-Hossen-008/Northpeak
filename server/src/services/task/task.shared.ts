// Shared task service types and behavior-preserving helpers.
// Used by task workflow modules; it owns no request or response handling.
// Database reads and writes here retain the existing task service semantics.

import { isValidObjectId } from "mongoose";
import { Task, type ITask, type TaskWorkflowStatus } from "../../models/Task.js";
import { Project } from "../../models/Project.js";
import { User } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import { serializeTask, type SerializedTask } from "../../serializers/task.serializer.js";

export interface CreateTaskInput {
  project_id?: string;
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  deadline?: string | null;
  priority?: any;
  status?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  deadline?: string | null;
  priority?: any;
  status?: string;
  is_completed?: unknown;
}

export interface AssigneeResolution {
  isDefined: boolean;
  user: any | null;
  id: string | null;
}

const TASK_WORKFLOW_STATUSES: TaskWorkflowStatus[] = ["todo", "in_progress", "in_review", "done"];

/**
 * Populates and serializes one task after a successful task write.
 * Who may call it: task write workflows. Side effects: database reads only.
 * Errors: database errors propagate without an HTTP status.
 */
export async function fetchPopulatedTask(taskId: any): Promise<SerializedTask> {
  const populated = await Task.findById(taskId)
    .populate("project", "title")
    .populate("assignedDeveloper", "name email")
    .populate("createdBy", "name")
    .populate("assignedBy", "name");
  return serializeTask(populated);
}

/**
 * Resolves an optional assignee and confirms project team membership.
 * Who may call it: task create and update workflows. Side effects: updates the project's updatedAt.
 * Errors: 400 ("Invalid developer ID", "Assigned user must have developer role", or team mismatch);
 * 404 ("Developer not found").
 */
export async function validateAndResolveAssignee(
  projectId: any,
  assignedDevId?: string | null,
): Promise<AssigneeResolution> {
  if (assignedDevId === undefined) {
    return { isDefined: false, user: null, id: null };
  }
  if (!assignedDevId || assignedDevId === "unassigned") {
    return { isDefined: true, user: null, id: null };
  }
  if (!isValidObjectId(assignedDevId)) {
    throw new AppError("Invalid developer ID", 400);
  }

  const devUser = await User.findById(assignedDevId);
  if (!devUser) {
    throw new AppError("Developer not found", 404);
  }
  if (devUser.role !== "developer") {
    throw new AppError("Assigned user must have developer role", 400);
  }

  await assertProjectTeamMembership(projectId, devUser);
  return { isDefined: true, user: devUser, id: devUser._id.toString() };
}

/** Verifies membership with the same atomic project write used during assignment validation. */
async function assertProjectTeamMembership(projectId: any, devUser: any): Promise<void> {
  const projectWithMember = await Project.findOneAndUpdate(
    { _id: projectId, team: devUser._id },
    { $set: { updatedAt: new Date() } },
    { new: true },
  );
  if (!projectWithMember) {
    throw new AppError(
      "Developer does not belong to the selected project's engineering team",
      400,
    );
  }
}

/**
 * Applies task status and completion fields using the established transition rules.
 * Who may call it: task write workflows. Side effects: mutates only the supplied task document.
 * Errors: none.
 */
export function applyTaskWorkflowState(
  task: Pick<ITask, "status" | "isCompleted" | "completedAt">,
  status?: TaskWorkflowStatus,
  isCompletedInput?: boolean,
): void {
  if (status !== undefined) {
    task.status = status;
    if (status === "done") {
      task.isCompleted = true;
      if (!task.completedAt) task.completedAt = new Date();
    } else {
      task.isCompleted = false;
      task.completedAt = null;
    }
  } else if (isCompletedInput !== undefined) {
    task.isCompleted = isCompletedInput;
    if (isCompletedInput) {
      if (!task.completedAt) task.completedAt = new Date();
      task.status = "done";
    } else {
      task.completedAt = null;
      task.status = "todo";
    }
  }
}

/**
 * Validates a supplied workflow status with the existing error message and status.
 * Who may call it: task create and update workflows. Side effects: none.
 * Errors: 400 ("Invalid task status. Expected one of: todo, in_progress, in_review, done").
 */
export function parseWorkflowStatus(status: string): TaskWorkflowStatus {
  if (!TASK_WORKFLOW_STATUSES.includes(status as TaskWorkflowStatus)) {
    throw new AppError(
      `Invalid task status. Expected one of: ${TASK_WORKFLOW_STATUSES.join(", ")}`,
      400,
    );
  }
  return status as TaskWorkflowStatus;
}

/**
 * Parses an optional boolean field and keeps undefined distinct from false.
 * Who may call it: task update workflow. Side effects: none.
 * Errors: 400 ("<fieldName> must be a boolean") when a supplied value is not boolean.
 */
export function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }
  return value;
}

/**
 * Parses a required boolean field with the existing validation message.
 * Who may call it: task completion workflow. Side effects: none.
 * Errors: 400 ("<fieldName> must be a boolean") for a non-boolean value.
 */
export function parseRequiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }
  return value;
}
