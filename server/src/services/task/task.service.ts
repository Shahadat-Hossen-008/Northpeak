// Public task service API with operations grouped in focused modules.
// Called by routes/tasks.ts; taskService retains the previous value export.
// This façade owns no database queries or request/response handling.

import { createTask } from "./task.create.js";
import { toggleComplete } from "./task.complete.js";
import { deleteTask } from "./task.delete.js";
import { getTaskById, getTasks } from "./task.read.js";
import { updateTask } from "./task.update.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import type { SerializedTask } from "../../serializers/task.serializer.js";
import type { CreateTaskInput, UpdateTaskInput } from "./task.shared.js";

export { createTask, deleteTask, getTaskById, getTasks, toggleComplete, updateTask };
export type { AssigneeResolution, CreateTaskInput, UpdateTaskInput } from "./task.shared.js";

/** Retains the previous service instance's method type while the implementation uses plain functions. */
export interface TaskService {
  getTasks(user: AuthUserPayload, query: any): Promise<SerializedTask[]>;
  getTaskById(taskId: string, user: AuthUserPayload): Promise<SerializedTask>;
  createTask(user: AuthUserPayload, input: CreateTaskInput): Promise<SerializedTask>;
  updateTask(taskId: string, user: AuthUserPayload, input: UpdateTaskInput): Promise<SerializedTask>;
  toggleComplete(taskId: string, user: AuthUserPayload, completed: unknown): Promise<SerializedTask>;
  deleteTask(taskId: string, user: AuthUserPayload): Promise<{ success: boolean; message: string }>;
}

/** Compatibility value for callers that previously imported the taskService singleton. */
export const taskService: TaskService = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleComplete,
  deleteTask,
};
