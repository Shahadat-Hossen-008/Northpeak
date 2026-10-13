import { cn } from "@/lib/utils";
import { PRIORITY_STYLES } from "../utils";
import type { PriorityBadgeProps } from "./interface";

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const style =
    priority && PRIORITY_STYLES[priority] ? PRIORITY_STYLES[priority] : PRIORITY_STYLES.medium;
  const label = priority ?? "medium";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default PriorityBadge;
export type { PriorityBadgeProps } from "./interface";
