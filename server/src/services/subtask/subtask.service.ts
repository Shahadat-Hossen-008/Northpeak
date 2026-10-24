// Business rules for subtasks: listing, creating, updating and deleting them.
// Called by routes/subtasks.ts, the only importer; every other file in this folder is private.
// Must not touch req or res. Assignee rules live in subtask.assignee.ts and the shared
// task/project lookup in subtask.access.ts.

import mongoose, { isValidObjectId } from "mongoose";
import { Subtask } from "../../models/Subtask.js";
import { Task } from "../../models/Task.js";
import { Project } from "../../models/Project.js";
import { Activity } from "../../models/Activity.js";
import { Notification } from "../../models/Notification.js";
import { AppError } from "../../middleware/error.js";
import { serializeSubtask, type SerializedSubtask } from "../../serializers/subtask.serializer.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { assertAssigneeStillInTeam, resolveAssignee } from "./subtask.assignee.js";
import { canAccessTask, loadTaskAndProject } from "./subtask.access.js";
import { validateCreateInput, assertCanCreate, insertSubtask } from "./subtask.create.js";
import { assertUpdateAllowed, applyTextFields, applyAssignment, applyCompletion } from "./subtask.update.js";

import type { CreateSubtaskInput, UpdateSubtaskInput } from "./subtask.types.js";

import type { SubtaskDoc, TaskDoc, ProjectDoc } from "./subtask.types.js";

const OLDEST_FIRST = 1;

/**
 * Lists every subtask the caller can see: a manager's own projects, or a developer's assigned tasks.
 * Read-only, no side effects.
 */
export async function getAllSubtasks(user: AuthUserPayload): Promise<SerializedSubtask[]> {
  const tasks =
    user.role === "manager"
      ? await Task.find({
          project: { $in: await Project.find({ manager: user.id }).distinct("_id") },
        }).select("_id")
      : await Task.find({ assignedDeveloper: user.id }).select("_id");
  const taskIds = tasks.map((task) => task._id);
  const subtasks = await populateAssignee(
    Subtask.find({ task: { $in: taskIds } }).sort({ createdAt: OLDEST_FIRST }),
  );
  return subtasks.map(serializeSubtask);
}

/** Adds the assignee's name to a subtask query. */
function populateAssignee(query: any) {
  return query.populate("assignedDeveloper", "name");
}

/**
 * Lists the subtasks of one task. Callable by the project's manager or the task's assignee.
 * Read-only, no side effects.
 * Errors: 400 "Invalid task ID format", 404 "Task not found" or "Project not found",
 * 403 "Not authorized to view subtasks for this task".
 */
export async function getSubtasksByTaskId(
  taskId: string,
  user: AuthUserPayload,
): Promise<SerializedSubtask[]> {
  if (!isValidObjectId(taskId)) {
    throw new AppError("Invalid task ID format", 400);
  }

  await canAccessTask(taskId, user);
  const subtasks = await populateAssignee(
    Subtask.find({ task: taskId }).sort({ createdAt: OLDEST_FIRST }),
  );
  return subtasks.map(serializeSubtask);
}

/**
 * Creates a subtask. Callable by the project's manager or the task's assignee; only the manager
 * may set an assignee. Writes the subtask, then an Activity "added subtask ...".
 * Errors: 400 "Subtask parent cannot be changed", 400 "Subtask title is required",
 * 404 "Task not found" or "Project not found",
 * 403 "Not authorized to add subtasks to this task", 403 "Not authorized to assign subtasks",
 * plus the assignee errors from resolveAssignee and assertAssigneeStillInTeam.
 */
export async function createSubtask(
  taskId: string,
  user: AuthUserPayload,
  input: CreateSubtaskInput,
): Promise<SerializedSubtask> {
  const { description, assigned_developer_id } = input;

  // 1. Validate input
  const title = validateCreateInput(input);
  if (!isValidObjectId(taskId)) {
    throw new AppError("Task not found", 404);
  }

  // 2. Load what it needs
  const { task, project } = await loadTaskAndProject(taskId);

  // 3. Check permission
  assertCanCreate(user, task, project, assigned_developer_id);

  // 4. Apply the rule or change
  const assignedDeveloper =
    assigned_developer_id === undefined
      ? null
      : await resolveAssignee(task.project.toString(), assigned_developer_id);
  const subtask = await insertSubtask(task, title, description, assignedDeveloper);

  // 5. Side effects (activity, notifications)
  await Activity.create({
    project: task.project,
    task: task._id,
    actor: user.id,
    message: `added subtask "${subtask.title}"`,
  });

  // 6. Return the serialized result
  const populated = await populateAssignee(Subtask.findById(subtask._id));
  return serializeSubtask(populated);
}



/** Allows the project's manager or the task's assignee; only the manager may set an assignee. */

/**
 * Updates a subtask's title, description, assignee or completion. Callable by the project's
 * manager or the task's assignee; only a manager may send assigned_developer_id.
 * Completing a subtask creates a "subtask_completed" Notification for managers.
 * Errors: 404 "Subtask not found", "Task not found" or "Project not found",
 * 403 "Not authorized to modify this subtask", 400 "Subtask parent cannot be changed",
 * 403 "Not authorized to assign subtasks", 400 "Subtask title is required",
 * 400 "Subtask description must be a string", 400 "is_completed must be a boolean",
 * plus the assignee errors from resolveAssignee and assertAssigneeStillInTeam.
 */
export async function updateSubtask(
  subtaskId: string,
  user: AuthUserPayload,
  input: UpdateSubtaskInput,
): Promise<SerializedSubtask> {
  // 1. Validate input
  if (!isValidObjectId(subtaskId)) {
    throw new AppError("Subtask not found", 404);
  }

  // 2. Load what it needs
  const subtask = await Subtask.findById(subtaskId);
  if (!subtask) {
    throw new AppError("Subtask not found", 404);
  }
  const { task, project } = await loadTaskAndProject(subtask.task);

  // 3. Check permission
  const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
  const isAssignee = task.assignedDeveloper?.toString() === user.id;
  if (!isProjectManager && !isAssignee) {
    throw new AppError("Not authorized to modify this subtask", 403);
  }
  const assignmentProvided = assertUpdateAllowed(user, input);

  // 4. Apply the rule or change
  applyTextFields(subtask, input);
  if (assignmentProvided) {
    await applyAssignment(subtask, task.project.toString(), input.assigned_developer_id ?? null);
  }
  if (input.is_completed !== undefined) {
    await applyCompletion(subtask, task, input.is_completed);
  }
  await subtask.save();

  if (assignmentProvided && subtask.assignedDeveloper && !subtask.isCompleted) {
    await assertAssigneeStillInTeam(task.project.toString(), subtask);
  }

  // 6. Return the serialized result
  const populated = await populateAssignee(Subtask.findById(subtask._id));
  return serializeSubtask(populated);
}

/** Rejects parent fields, and assignee changes from non-managers; returns whether an assignee was sent. */
// Helper functions moved to subtask.update.ts
/**
 * Deletes a subtask. Callable by the project's manager or the task's assignee. No activity or
 * notification is written.
 * Errors: 404 "Subtask not found", "Task not found" or "Project not found",
 * 403 "Not authorized to delete this subtask".
 */
export async function deleteSubtask(
  subtaskId: string,
  user: AuthUserPayload,
): Promise<{ success: boolean; message: string }> {
  // 1. Validate input
  if (!isValidObjectId(subtaskId)) {
    throw new AppError("Subtask not found", 404);
  }

  // 2. Load what it needs
  const subtask = await Subtask.findById(subtaskId);
  if (!subtask) {
    throw new AppError("Subtask not found", 404);
  }
  const { task, project } = await loadTaskAndProject(subtask.task);

  // 3. Check permission
  const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
  const isAssignee = task.assignedDeveloper?.toString() === user.id;
  if (!isProjectManager && !isAssignee) {
    throw new AppError("Not authorized to delete this subtask", 403);
  }

  // 4. Apply the rule or change
  await subtask.deleteOne();

  // 6. Return the serialized result
  return { success: true, message: "Subtask deleted" };
}
