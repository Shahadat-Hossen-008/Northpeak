// Helper functions for updating a subtask, moved from subtask.service.ts

import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";

import type { UpdateSubtaskInput, SubtaskDoc, TaskDoc } from "./subtask.types.js";
import { resolveAssignee } from "./subtask.assignee.js";
import { Notification } from "../../models/Notification.js";
import mongoose from "mongoose";

/** Rejects parent fields, and assignee changes from non-managers; returns whether an assignee was sent. */
export function assertUpdateAllowed(user: AuthUserPayload, input: UpdateSubtaskInput): boolean {
  if ("task" in input || "project" in input) {
    throw new AppError("Subtask parent cannot be changed", 400);
  }
  const assignmentProvided = Object.prototype.hasOwnProperty.call(input, "assigned_developer_id");
  if (assignmentProvided && user.role !== "manager") {
    throw new AppError("Not authorized to assign subtasks", 403);
  }
  return assignmentProvided;
}

/** Validates and sets the title, then the description, when they are present in the input. */
export function applyTextFields(subtask: SubtaskDoc, input: UpdateSubtaskInput): void {
  const { title, description } = input;
  if (title !== undefined) {
    if (!title.trim()) {
      throw new AppError("Subtask title is required", 400);
    }
    subtask.title = title.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      throw new AppError("Subtask description must be a string", 400);
    }
    subtask.description = description.trim();
  }
}

/** Resolves the requested assignee and sets it on the subtask; null clears the assignment. */
export async function applyAssignment(
  subtask: SubtaskDoc,
  projectId: string,
  assignedDeveloperId: string | null,
): Promise<void> {
  const resolvedAssignee = await resolveAssignee(projectId, assignedDeveloperId);
  subtask.assignedDeveloper = resolvedAssignee ? new mongoose.Types.ObjectId(resolvedAssignee) : null;
}

/** Validates and sets completion; marking a subtask done creates the manager notification. */
export async function applyCompletion(
  subtask: SubtaskDoc,
  task: TaskDoc,
  isCompleted: unknown,
): Promise<void> {
  if (typeof isCompleted !== "boolean") {
    throw new AppError("is_completed must be a boolean", 400);
  }
  subtask.isCompleted = isCompleted;
  subtask.completedAt = isCompleted ? new Date() : null;
  if (isCompleted) {
    await Notification.create({
      audience: "manager",
      kind: "subtask_completed",
      title: "Subtask completed",
      body: `${subtask.title} was marked complete.`,
      task: task._id,
      project: task.project,
    });
  }
}
