import type React from "react";
import type { Project, Subtask, Task } from "@/types";

export interface ProjectOverviewCardProps {
  project: Project;
  tasks: Task[];
  subtasks: Subtask[];
}

export interface ProjectTasksListProps {
  tasks: Task[];
  subtasks: Subtask[];
  commentCounts: Record<string, number>;
  hrefFor: (task: Task) => string;
  renderAddTask?: React.ReactNode | undefined;
}
