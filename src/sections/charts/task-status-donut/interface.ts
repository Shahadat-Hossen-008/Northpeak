import type { Task } from "@/types";

export interface TaskStatusDonutChartProps {
  tasks: Task[];
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  errorMessage?: string | undefined;
  className?: string | undefined;
}

export interface StatusItem {
  key: "in_progress" | "overdue" | "completed" | "todo";
  label: string;
  count: number;
  percentage: number;
  color: string;
  trackColor: string;
  radius: number;
  isArc: boolean;
}
