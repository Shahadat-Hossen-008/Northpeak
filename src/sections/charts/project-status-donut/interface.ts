import type { Project, Task } from "@/types";

export interface ProjectStatusDonutChartProps {
  projects: Project[];
  tasks: Task[];
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  errorMessage?: string | undefined;
  className?: string | undefined;
}

export interface ProjectSlice {
  key: "on_track" | "due_soon" | "overdue" | "completed";
  label: string;
  count: number;
  percentage: number;
  color: string;
}
