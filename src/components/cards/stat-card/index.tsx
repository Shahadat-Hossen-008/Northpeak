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
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="tabular mt-2 text-3xl font-bold text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className={cn("inline-flex size-10 items-center justify-center rounded-lg", toneClass)}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

export default StatCard;
export type { StatCardProps, StatTone } from "./interface";
