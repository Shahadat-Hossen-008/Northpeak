// Task creation and its assignment race safeguards.
// Called by the task service façade for authenticated manager requests.
// Query and side-effect order matches the original task service workflow.

import { isValidObjectId, Types } from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Notification } from "../../models/Notification.js";
import { Project, type IProject } from "../../models/Project.js";
import { Task, type ITask, type TaskWorkflowStatus } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { concurrencyTestBarriers } from "../team.js";
import { reconcileAssignmentsSafely } from "../reconcile.service.js";
import type { SerializedTask } from "../../serializers/task.serializer.js";
import {
  applyTaskWorkflowState,
  fetchPopulatedTask,
  parseWorkflowStatus,
  validateAndResolveAssignee,
  type AssigneeResolution,
  type CreateTaskInput,
} from "./task.shared.js";

/**
 * Creates a task for a project manager, then records its activity and optional assignment notice.
 * Who may call it: authenticated project managers. Side effects: task, activity, optional notification.
 * Errors: 400 ("Project and task title (min 3 chars) are required", "Invalid project ID", invalid task status,
 * "Invalid developer ID", "Assigned user must have developer role", or team mismatch); 404 ("Project not found" or "Developer not found");
 * 403 ("Not authorized to create tasks for this project"). Database errors propagate.
 */
export async function createTask(
  user: AuthUserPayload,
  input: CreateTaskInput,
): Promise<SerializedTask> {
  const { project_id, title, assigned_developer_id, status } = input;
  // 1. Validate required fields and the project identifier.
  validateCreateInput(project_id, title);
  // 2. Load the project needed to create the task.
  // 3. Apply the project-manager authorization rule before continuing.
  const project = await loadAuthorizedProject(project_id!, user);
  // 4. Resolve workflow and assignment values, then persist the task.
  const parsedStatus = status === undefined ? undefined : parseWorkflowStatus(status);
  const assignee = await validateAndResolveAssignee(project._id, assigned_developer_id);
  const task = buildTaskRecord(user, project, input, assignee, parsedStatus);
  await task.save();

  // 5. Recheck assignment membership before writing activity and notification.
  await verifyCreatedTaskAssignment(task, project._id, assignee.id);
  await recordTaskCreationSideEffects(task, project, user);
  // 6. Return the populated task representation.
  return fetchPopulatedTask(task._id);
}

/** Validates required task creation fields before project lookup. */
function validateCreateInput(projectId?: string, title?: string): void {
  if (!projectId || !title || title.trim().length < 3) {
    throw new AppError("Project and task title (min 3 chars) are required", 400);
  }
  if (!isValidObjectId(projectId)) {
    throw new AppError("Invalid project ID", 400);
  }
}

/** Loads the project and applies the existing manager authorization check. */
async function loadAuthorizedProject(projectId: string, user: AuthUserPayload): Promise<IProject> {
  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);
  // Only the authorized project manager can create tasks for this project.
  if (project.manager.toString() !== user.id) {
    throw new AppError("Not authorized to create tasks for this project", 403);
  }
  return project;
}

/** Builds the unsaved task while preserving the original field defaults and workflow update. */
function buildTaskRecord(
  user: AuthUserPayload,
  project: IProject,
  input: CreateTaskInput,
  assignee: AssigneeResolution,
  parsedStatus?: TaskWorkflowStatus,
): ITask {
  const { title, description, deadline, priority } = input;
  const task = new Task({
    project: project._id,
    title: title!.trim(),
    description: (description || "").trim(),
    assignedDeveloper: assignee.id,
    createdBy: user.id,
    assignedBy: assignee.id ? user.id : null,
    deadline: deadline ? new Date(deadline) : null,
    priority: priority || "medium",
    status: "todo",
    isCompleted: false,
    completedAt: null,
  });
  if (parsedStatus !== undefined) applyTaskWorkflowState(task, parsedStatus);
  return task;
}

/** Runs both task-creation barriers and compensates or reconciles a removed assignee. */
async function verifyCreatedTaskAssignment(
  task: ITask,
  projectId: Types.ObjectId,
  assignedDevId: string | null,
): Promise<void> {
  if (concurrencyTestBarriers.afterTaskCreateSave) {
    await concurrencyTestBarriers.afterTaskCreateSave();
  }

  // Recheck membership after save because the team can change during task creation.
  if (assignedDevId) {
    const currentProject = await Project.findById(projectId).select("team");
    const isStillMember = currentProject?.team?.some((id) => id.toString() === assignedDevId);
    if (!isStillMember) {
      try {
        await Task.findByIdAndDelete(task._id);
      } catch (cleanupErr) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Task cleanup failed after membership loss; deferring to reconciler",
            taskId: task._id.toString(),
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          }),
        );
        await reconcileAssignmentsSafely({ projectId });
      }
      throw new AppError(
        "Developer does not belong to the selected project's engineering team",
        400,
      );
    }
  }

  if (concurrencyTestBarriers.afterTaskCreateMembershipCheck) {
    await concurrencyTestBarriers.afterTaskCreateMembershipCheck();
  }
}

/** Writes task creation activity before creating an optional assignment notification. */
async function recordTaskCreationSideEffects(
  task: ITask,
  project: IProject,
  user: AuthUserPayload,
): Promise<void> {
  await Activity.create({
    project: project._id,
    task: task._id,
    actor: user.id,
    message: `created task ${task.title}`,
  });
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
}
