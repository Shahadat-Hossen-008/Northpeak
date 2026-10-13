import { cn } from "@/lib/utils";
import type { ProgressBarProps } from "./interface";

export function ProgressBar({ value, tone = "primary", className }: ProgressBarProps) {
  const toneClass = {
    primary: "bg-primary",
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
  }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", toneClass)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default ProgressBar;
export type { ProgressBarProps, ProgressTone } from "./interface";
