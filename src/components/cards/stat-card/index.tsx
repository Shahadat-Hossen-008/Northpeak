import { cn } from "@/lib/utils";
import type { StatCardProps } from "./interface";

export function StatCard({ label, value, icon: Icon, tone = "neutral", hint }: StatCardProps) {
  const toneClass = {
    neutral: "bg-secondary text-secondary-foreground",
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning-foreground",
  }[tone];

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base font-medium text-muted-foreground">{label}</p>
          <p className="tabular mt-2 text-3xl sm:text-4xl font-bold text-foreground">{value}</p>
          {hint ? <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-xl shrink-0",
            toneClass,
          )}
        >
          <Icon className="size-5 sm:size-5.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export default StatCard;
export type { StatCardProps, StatTone } from "./interface";
