// Input shapes shared by the files in services/subtask/.
// Re-exported by the public service file, the only file other modules import.
// Holds types only; it must not contain logic.

import type { Subtask } from "../../models/Subtask.js";
import type { Task } from "../../models/Task.js";
import type { Project } from "../../models/Project.js";

export interface CreateSubtaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
}

export interface UpdateSubtaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  is_completed?: unknown;
}

// Internal type aliases for model documents
export type SubtaskDoc = InstanceType<typeof Subtask>;
export type TaskDoc = InstanceType<typeof Task>;
export type ProjectDoc = InstanceType<typeof Project>;
