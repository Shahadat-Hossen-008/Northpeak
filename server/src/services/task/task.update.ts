// Task field, assignment, and workflow updates.
// Called by routes/tasks.ts for authenticated managers and assigned developers.
// Assignment barriers, compensation, and reconciliation retain their existing order.

import { isValidObjectId, Types } from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Notification } from "../../models/Notification.js";
import { Project } from "../../models/Project.js";
import { Task, type ITask } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { concurrencyTestBarriers } from "../team.js";
import { reconcileAssignmentsSafely } from "../reconcile.service.js";
import type { SerializedTask } from "../../serializers/task.serializer.js";
import {
  applyTaskWorkflowState,
  fetchPopulatedTask,
  parseOptionalBoolean,
  parseWorkflowStatus,
  validateAndResolveAssignee,
  type UpdateTaskInput,
} from "./task.shared.js";

/**
 * Updates task fields, assignment, or workflow for an authorized manager or assignee.
 * Who may call it: authenticated project managers and task assignees.
 * Side effects: task write, activity, optional assignment notification.
 * Errors: 400 ("is_completed must be a boolean", invalid status, "Invalid developer ID", role, or team validation);
 * 403 ("Not authorized to update this task", manage the project, or reassign); 404 (task, project, or developer not found).
 * Database errors propagate.
 */
export async function updateTask(
  taskId: string,
  user: AuthUserPayload,
  input: UpdateTaskInput,
): Promise<SerializedTask> {
  // 1. Load the task and project in the existing query order.
  // 2. Enforce access before changing task fields.
  const { task, isManager } = await loadAuthorizedTask(taskId, user);
  // 3. Apply the requested field and workflow changes.
  const update = await applyTaskUpdate(task, user, input, isManager);
  // 4. Persist the task changes.
  await task.save();
  // 5. Recheck assignment membership, then write activity and any notice.
  await verifyUpdatedAssignment(task, update.assignedDevUser);
  await recordTaskUpdateSideEffects(task, user, update);
  // 6. Return the populated task representation.
  return fetchPopulatedTask(task._id);
}

/** Loads a task, then preserves its task-level and project-manager authorization order. */
async function loadAuthorizedTask(
  taskId: string,
  user: AuthUserPayload,
): Promise<{ task: ITask; isManager: boolean }> {
  if (!isValidObjectId(taskId)) throw new AppError("Task not found", 404);
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);

  const isManager = user.role === "manager";
  const isAssignee = task.assignedDeveloper?.toString() === user.id;
  if (!isManager && !isAssignee) {
    throw new AppError("Not authorized to update this task", 403);
  }

  const project = await Project.findById(task.project);
  if (!project) throw new AppError("Project not found", 404);
  // Managers must own the project; assignees retain the original task-level access check.
  if (isManager && project.manager.toString() !== user.id) {
    throw new AppError("Not authorized to manage tasks for this project", 403);
  }
  return { task, isManager };
}

/** Applies parsed task fields in the original assignment-then-manager-fields-then-workflow order. */
async function applyTaskUpdate(
  task: ITask,
  user: AuthUserPayload,
  input: UpdateTaskInput,
  isManager: boolean,
): Promise<{ previousAssignee?: string; previousStatus: string; status?: string; assignedDevUser: any }> {
  const { title, description, assigned_developer_id, deadline, priority, is_completed, status } =
    input;
  const previousAssignee = task.assignedDeveloper?.toString();
  const previousStatus = task.status;
  const parsedCompleted = parseOptionalBoolean(is_completed, "is_completed");
  const parsedStatus = status === undefined ? undefined : parseWorkflowStatus(status);
  let assignedDevUser: any = null;

  if (assigned_developer_id !== undefined) {
    if (!isManager) throw new AppError("Not authorized to reassign this task", 403);
    const assignee = await validateAndResolveAssignee(task.project, assigned_developer_id);
    task.assignedDeveloper = assignee.user ? assignee.user._id : null;
    assignedDevUser = assignee.user;
    if (assignee.id !== (previousAssignee ?? null)) {
      task.assignedBy = assignee.id ? new Types.ObjectId(user.id) : null;
    }
  }

  if (isManager) {
    if (title !== undefined) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
    if (priority !== undefined) task.priority = priority;
  }
  applyTaskWorkflowState(task, parsedStatus, parsedCompleted);
  return { previousAssignee, previousStatus, status, assignedDevUser };
}

/** Runs the patch barriers and preserves compensation/reconciliation after membership loss. */
async function verifyUpdatedAssignment(task: ITask, assignedDevUser: any): Promise<void> {
  if (concurrencyTestBarriers.afterTaskPatchSave) {
    await concurrencyTestBarriers.afterTaskPatchSave();
  }

  // Recheck membership after save because the project team can change concurrently.
  if (assignedDevUser) {
    const currentProject = await Project.findById(task.project).select("team");
    const isStillMember = currentProject?.team?.some(
      (id) => id.toString() === assignedDevUser._id.toString(),
    );
    if (!isStillMember) {
      try {
        task.assignedDeveloper = null;
        task.assignedBy = null;
        await task.save();
      } catch (cleanupErr) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Task unassign failed after membership loss; deferring to reconciler",
            taskId: task._id.toString(),
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          }),
        );
        await reconcileAssignmentsSafely({ projectId: task.project });
      }
      throw new AppError(
        "Developer does not belong to the selected project's engineering team",
        400,
      );
    }
  }

  if (concurrencyTestBarriers.afterTaskPatchMembershipCheck) {
    await concurrencyTestBarriers.afterTaskPatchMembershipCheck();
  }
}

/** Writes the existing update activity before notifying a newly assigned developer. */
async function recordTaskUpdateSideEffects(
  task: ITask,
  user: AuthUserPayload,
  update: { previousAssignee?: string; previousStatus: string; status?: string; assignedDevUser: any },
): Promise<void> {
  const { previousAssignee, previousStatus, status } = update;
  const activityMsg =
    status !== undefined && status !== previousStatus
      ? `moved ${task.title} to ${status.replace("_", " ")}`
      : `updated task ${task.title}`;
  await Activity.create({
    project: task.project,
    task: task._id,
    actor: user.id,
    message: activityMsg,
  });
  if (
    user.role === "manager" &&
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
}
