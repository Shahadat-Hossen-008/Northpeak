import { AlertTriangle, CheckCircle2, Clock, CircleDot, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEADLINE_LABEL, deadlineState, deadlineText, type DeadlineState } from "@/lib/deadline";
import type { Priority } from "@/hooks/queries";

const STATE_STYLES: Record<DeadlineState, string> = {
  completed_on_time: "bg-success-soft text-success border-success/30",
  completed_late: "bg-warning-soft text-warning-foreground border-warning/40",
  overdue: "bg-danger-soft text-danger border-danger/30",
  due_soon: "bg-warning-soft text-warning-foreground border-warning/40",
  on_track: "bg-info-soft text-info border-info/30",
  no_deadline: "bg-muted text-muted-foreground border-border",
};

const STATE_ICON: Record<DeadlineState, typeof Clock> = {
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

export function StatusBadge({ state, className }: { state: DeadlineState; className?: string }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        STATE_STYLES[state],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {DEADLINE_LABEL[state]}
    </span>
  );
}

export function DeadlineBadge({
  deadline,
  state,
  className,
}: {
  deadline: string | null;
  state: DeadlineState;
  className?: string;
}) {
  const tone =
    state === "overdue"
      ? "text-danger"
      : state === "due_soon"
        ? "text-warning-foreground"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone, className)}>
      <CalendarClock className="size-3.5" aria-hidden />
      {deadline ? deadlineText(deadline) : "No deadline"}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-info-soft text-info border-info/30",
  high: "bg-warning-soft text-warning-foreground border-warning/40",
  critical: "bg-danger-soft text-danger border-danger/30",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {priority}
    </span>
  );
}

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
