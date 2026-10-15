import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { deadlineText } from "@/lib/deadline";
import type { DeadlineBadgeProps } from "./interface";

export function DeadlineBadge({ deadline, state, className }: DeadlineBadgeProps) {
  const tone =
    state === "overdue"
      ? "text-danger"
      : state === "due_soon"
        ? "text-warning-foreground"
        : "text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium",
        tone,
        className,
      )}
    >
      <CalendarClock className="size-3.5 sm:size-4 shrink-0" aria-hidden />
      {deadline ? deadlineText(deadline) : "No deadline"}
    </span>
  );
}

export default DeadlineBadge;
export type { DeadlineBadgeProps } from "./interface";
