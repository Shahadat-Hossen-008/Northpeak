export type AppRole = "manager" | "developer";

export type Priority = "low" | "medium" | "high" | "critical";

export type TaskWorkflowStatus = "todo" | "in_progress" | "in_review" | "done";

export type DeadlineState =
  "completed_on_time" | "completed_late" | "overdue" | "due_soon" | "on_track" | "no_deadline";

export interface DeadlineInput {
  deadline: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export type TaskViewMode = "board" | "list";
