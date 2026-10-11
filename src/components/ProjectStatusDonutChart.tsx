import * as React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { projectStats } from "@/components/ProjectCard";
import type { Project, Task } from "@/hooks/queries";

export interface ProjectStatusDonutChartProps {
  projects: Project[];
  tasks: Task[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  className?: string;
}

interface ProjectSlice {
  key: "on_track" | "due_soon" | "overdue" | "completed";
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export function ProjectStatusDonutChart({
  projects,
  tasks,
  isLoading = false,
  isError = false,
  errorMessage,
  className,
}: ProjectStatusDonutChartProps) {
  const [isMounted, setIsMounted] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const { total, slices, hasData } = React.useMemo(() => {
    const totalCount = projects.length;

    let completed = 0;
    let overdue = 0;
    let dueSoon = 0;
    let onTrack = 0;

    for (const project of projects) {
      const stats = projectStats(project, tasks);
      if (
        stats.allDone ||
        stats.state === "completed_on_time" ||
        stats.state === "completed_late"
      ) {
        completed++;
      } else if (stats.state === "overdue") {
        overdue++;
      } else if (stats.state === "due_soon") {
        dueSoon++;
      } else {
        onTrack++;
      }
    }

    const rawSlices = [
      {
        key: "on_track" as const,
        label: "On Track",
        count: onTrack,
        color: "#3b82f6", // Info Blue
      },
      {
        key: "due_soon" as const,
        label: "Due Soon",
        count: dueSoon,
        color: "#f59e0b", // Warning Amber
      },
      {
        key: "overdue" as const,
        label: "Overdue",
        count: overdue,
        color: "#ef4444", // Danger Red
      },
      {
        key: "completed" as const,
        label: "Completed",
        count: completed,
        color: "#10b981", // Success Green
      },
    ];

    // Guarantee percentages total exactly 100% using largest remainder distribution
    let percentages = [0, 0, 0, 0];
    if (totalCount > 0) {
      const exact = rawSlices.map((s) => (s.count / totalCount) * 100);
      const floors = exact.map(Math.floor);
      const diff = 100 - floors.reduce((a, b) => a + b, 0);

      const remainders = exact
        .map((val, idx) => ({
          idx,
          rem: val - (floors[idx] ?? 0),
          count: rawSlices[idx]?.count ?? 0,
        }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.rem - a.rem);

      percentages = [...floors];
      for (let i = 0; i < diff && remainders.length > 0; i++) {
        const item = remainders[i % remainders.length];
        if (item && item.idx in percentages) {
          percentages[item.idx] = (percentages[item.idx] ?? 0) + 1;
        }
      }
    }

    const computedSlices: ProjectSlice[] = rawSlices.map((slice, i) => ({
      ...slice,
      percentage: percentages[i] ?? 0,
    }));

    return {
      total: totalCount,
      slices: computedSlices,
      hasData: totalCount > 0,
    };
  }, [projects, tasks]);

  // Data formatted for Recharts Pie
  const chartData = React.useMemo(() => {
    if (!hasData) {
      return [{ name: "No projects", value: 1, color: "var(--border, #e2e8f0)", percentage: 0, key: "none" }];
    }
    const nonZero = slices.filter((s) => s.count > 0);
    return nonZero.map((s) => ({
      name: s.label,
      value: s.count,
      percentage: s.percentage,
      color: s.color,
      key: s.key,
    }));
  }, [hasData, slices]);

  return (
    <div
      className={cn("surface-card p-5 flex flex-col justify-between transition-all", className)}
      aria-label="Project Status"
    >
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground tracking-tight">Project Status</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Project distribution by status</p>
      </div>

      {/* Content Body */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-3">
          <div className="size-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground animate-pulse">Loading project statistics…</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="size-7 text-danger mb-2" />
          <p className="text-sm font-semibold text-foreground">Failed to load chart</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {errorMessage || "Unable to retrieve project metrics. Please refresh."}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6">
          {/* Donut Chart with Center Total */}
          <div className="relative size-40 sm:size-44 shrink-0 flex items-center justify-center overflow-visible">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
                <PieChart style={{ overflow: "visible" }}>
                  <Tooltip
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                    isAnimationActive={true}
                    animationDuration={150}
                    offset={10}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0];
                      if (!item || item.name === "No projects") return null;
                      const pct = item.payload.percentage ?? 0;
                      return (
                        <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs shadow-lg text-popover-foreground select-none pointer-events-none backdrop-blur-none z-50">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full inline-block"
                              style={{ backgroundColor: item.payload.color }}
                            />
                            {item.name}
                          </p>
                          <p className="tabular text-muted-foreground mt-0.5">
                            {item.value} {item.value === 1 ? "project" : "projects"} ({pct}%)
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={chartData.length > 1 ? 3 : 0}
                    cornerRadius={chartData.length > 1 ? 3 : 0}
                    stroke="none"
                    isAnimationActive={true}
                    animationDuration={600}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.55}
                        className="transition-opacity duration-200 cursor-pointer outline-none"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              /* Static placeholder during initial SSR render */
              <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="61"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="22"
                  className="stroke-muted/30"
                />
              </svg>
            )}

            {/* Centered Total Count matching visual reference ("8 Projects") */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="tabular text-3xl font-bold tracking-tight text-foreground leading-none">
                {total}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground mt-1 tracking-normal">
                Projects
              </span>
            </div>
          </div>

          {/* Detailed Legend: Colored indicator, label, project count, percentage */}
          <div className="flex-1 w-full space-y-2">
            {slices.map((slice) => (
              <div
                key={slice.key}
                onMouseEnter={() => {
                  const chartIdx = chartData.findIndex((c) => c.key === slice.key);
                  if (chartIdx !== -1) setActiveIndex(chartIdx);
                }}
                onMouseLeave={() => setActiveIndex(null)}
                className={cn(
                  "flex items-center justify-between py-1 transition-opacity cursor-pointer rounded-md px-1 -mx-1 hover:bg-muted/30",
                  slice.count === 0 ? "opacity-60" : "opacity-100",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {slice.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 tabular ml-2">
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    {slice.count}
                  </span>
                  <span className="text-xs text-muted-foreground min-w-[34px] text-right">
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
