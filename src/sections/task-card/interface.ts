import type React from "react";
import type { Subtask, Task, TaskWorkflowStatus } from "@/types";

export interface TaskCardProps {
  task: Task;
  subtasks?: Subtask[];
  href?: string;
  commentCount?: number | undefined;
  onToggle?: ((completed: boolean) => void) | undefined;
  toggleDisabled?: boolean | undefined;
  onMoveStatus?: ((status: TaskWorkflowStatus) => void) | undefined;
  isDraggable?: boolean | undefined;
  onDragStart?: ((e: React.DragEvent) => void) | undefined;
  onDragEnd?: ((e: React.DragEvent) => void) | undefined;
}
