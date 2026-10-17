import type React from "react";
import type { Subtask, Task } from "@/types";

export interface TaskCardProps {
  task: Task;
  subtasks?: Subtask[];
  href?: string;
  commentCount?: number | undefined;
  isDraggable?: boolean | undefined;
  onDragStart?: ((e: React.DragEvent) => void) | undefined;
  onDragEnd?: ((e: React.DragEvent) => void) | undefined;
}
