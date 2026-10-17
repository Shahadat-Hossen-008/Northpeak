import { cn } from "@/lib/utils";
import { DEADLINE_LABEL } from "@/lib/deadline";
import { STATE_ICON, STATE_STYLES } from "../utils";
import type { StatusBadgeProps } from "./interface";

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const Icon = state && STATE_ICON[state] ? STATE_ICON[state] : STATE_ICON.on_track;
  const style = state && STATE_STYLES[state] ? STATE_STYLES[state] : STATE_STYLES.on_track;
  const label = state && DEADLINE_LABEL[state] ? DEADLINE_LABEL[state] : "On track";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap",
        style,
        className,
      )}
    >
      <Icon className="size-3.5 sm:size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export default StatusBadge;
export type { StatusBadgeProps } from "./interface";
