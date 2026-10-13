import type { Subtask, Task, TaskWorkflowStatus } from "@/types";

export interface TaskBoardProps {
  tasks: Task[];
  subtasks: Subtask[];
  commentCounts: Record<string, number>;
  hrefFor: (task: Task) => string;
  onToggle?: ((task: Task, completed: boolean) => void) | undefined;
  onMoveStatus?: ((task: Task, newStatus: TaskWorkflowStatus) => void) | undefined;
  onAddTask?: ((status: TaskWorkflowStatus) => void) | undefined;
}
