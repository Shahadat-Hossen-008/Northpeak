import { cn } from "@/lib/utils";
import { CircularProgress } from "@/components/progress/circular-progress";
import type { DashboardMetricCardProps } from "./interface";

export function DashboardMetricCard({
  title,
  value,
  countSummary,
  tone = "primary",
  strokeColor,
  className,
}: DashboardMetricCardProps) {
  return (
    <div
      className={cn(
        "surface-card p-5 flex flex-col items-center justify-between text-center transition-all min-h-[175px]",
        className,
      )}
    >
      <h4 className="text-sm font-semibold text-foreground tracking-tight">{title}</h4>

      <div className="my-2.5 flex items-center justify-center">
        <CircularProgress
          value={value}
          size={74}
          strokeWidth={6}
          tone={tone}
          strokeColor={strokeColor}
          ariaLabel={`${title}: ${value}%`}
        />
      </div>

      <p className="text-xs font-medium text-muted-foreground tabular tracking-tight">
        {countSummary}
      </p>
    </div>
  );
}

export default DashboardMetricCard;
export type { DashboardMetricCardProps, MetricTone } from "./interface";
