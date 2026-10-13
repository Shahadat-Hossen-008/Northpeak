import type { Subtask, Task } from "@/types";

export interface TaskTableProps {
  tasks: Task[];
  subtasks: Subtask[];
  hrefFor: (task: Task) => string;
  onDelete?: (task: Task) => void;
}
