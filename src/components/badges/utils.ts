import { AlertTriangle, CheckCircle2, Clock, CircleDot, CalendarClock } from "lucide-react";
import { deadlineState } from "@/lib/deadline";
import type { DeadlineState, Priority } from "@/types";

export const STATE_STYLES: Record<DeadlineState, string> = {
  completed_on_time: "bg-success-soft text-success border-success/30",
  completed_late: "bg-warning-soft text-warning-foreground border-warning/40",
  overdue: "bg-danger-soft text-danger border-danger/30",
  due_soon: "bg-warning-soft text-warning-foreground border-warning/40",
  on_track: "bg-info-soft text-info border-info/30",
  no_deadline: "bg-muted text-muted-foreground border-border",
};

export const STATE_ICON: Record<DeadlineState, typeof Clock> = {
  completed_on_time: CheckCircle2,
  completed_late: CheckCircle2,
  overdue: AlertTriangle,
  due_soon: Clock,
  on_track: CircleDot,
  no_deadline: CalendarClock,
};

export function statusOf(task: {
  deadline: string | null;
  is_completed: boolean;
  completed_at: string | null;
}): DeadlineState {
  return deadlineState({
    deadline: task.deadline,
    isCompleted: task.is_completed,
    completedAt: task.completed_at,
  });
}

export const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info-soft text-info border-info/30",
  high: "bg-warning-soft text-warning-foreground border-warning/40",
  critical: "bg-danger-soft text-danger border-danger/30",
};

export function borderForState(state: DeadlineState): string {
  switch (state) {
    case "overdue":
      return "border-danger/50";
    case "completed_on_time":
      return "border-success/50";
    case "completed_late":
      return "border-warning/50";
    case "due_soon":
      return "border-warning/40";
    default:
      return "border-border";
  }
}
