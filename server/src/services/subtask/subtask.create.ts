// Helper functions for creating a subtask, moved from subtask.service.ts

import { AppError } from "../../middleware/error.js";
import { Subtask } from "../../models/Subtask.js";
import type { TaskDoc, ProjectDoc, SubtaskDoc } from "./subtask.types.js";
import { assertAssigneeStillInTeam, resolveAssignee } from "./subtask.assignee.js";
import type { CreateSubtaskInput } from "./subtask.types.js";
import type { AuthUserPayload } from "../../middleware/auth.js";

/** Rejects parent fields and a blank title, and returns the trimmed title. */
export function validateCreateInput(input: CreateSubtaskInput): string {
  if ("task" in input || "project" in input) {
    throw new AppError("Subtask parent cannot be changed", 400);
  }
  if (!input.title || !input.title.trim()) {
    throw new AppError("Subtask title is required", 400);
  }
  return input.title.trim();
}

/** Allows the project's manager or the task's assignee; only the manager may set an assignee. */
export function assertCanCreate(
  user: AuthUserPayload,
  task: TaskDoc,
  project: ProjectDoc,
  assignedDeveloperId: string | null | undefined,
): void {
  const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
  const isAssignee = task.assignedDeveloper?.toString() === user.id;

  if (!isProjectManager && !isAssignee) {
    throw new AppError("Not authorized to add subtasks to this task", 403);
  }
  if (assignedDeveloperId !== undefined && assignedDeveloperId !== null && !isProjectManager) {
    throw new AppError("Not authorized to assign subtasks", 403);
  }
}

/** Writes the subtask, then re-checks that its assignee is still on the project team. */
export async function insertSubtask(
  task: TaskDoc,
  title: string,
  description: unknown,
  assignedDeveloper: string | null,
): Promise<SubtaskDoc> {
  const subtask = await Subtask.create({
    task: task._id,
    title,
    description: typeof description === "string" ? description.trim() : "",
    assignedDeveloper,
  });

  if (assignedDeveloper) {
    await assertAssigneeStillInTeam(task.project.toString(), subtask);
  }
  return subtask;
}
