import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTaskCategory } from "@/lib/task-utils";
import type { StatusItem, TaskStatusDonutChartProps } from "./interface";

// Geometric constants for the 270° open-arc gauge (gap at bottom)
const CX = 110;
const CY = 88;
const START_DEG = 135; // Bottom-left
const END_DEG = 405; // Bottom-right (45°)
const DEG_TO_RAD = Math.PI / 180;

function getArcCoords(r: number, deg: number) {
  const rad = deg * DEG_TO_RAD;
  return {
    x: Number((CX + r * Math.cos(rad)).toFixed(2)),
    y: Number((CY + r * Math.sin(rad)).toFixed(2)),
  };
}

function getArcPath(r: number) {
  const start = getArcCoords(r, START_DEG);
  const end = getArcCoords(r, END_DEG);
  // Large arc flag 1 (270° > 180°), sweep flag 1 (clockwise)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

// Arc length is (270/360) * 2 * PI * r = 1.5 * PI * r
function getArcLength(r: number) {
  return 1.5 * Math.PI * r;
}

export function TaskStatusDonutChart({
  tasks,
  isLoading = false,
  isError = false,
  errorMessage,
  className,
}: TaskStatusDonutChartProps) {
  const [mounted, setMounted] = React.useState(false);
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  // Compute mutually exclusive categories to strictly prevent double-counting
  const { total, items, hasData } = React.useMemo(() => {
    const taskList = tasks ?? [];
    const totalCount = taskList.length;

    let completed = 0;
    let overdue = 0;
    let inProgress = 0;
    let todo = 0;

    for (const t of taskList) {
      const cat = getTaskCategory(t);
      if (cat === "completed") {
        completed++;
      } else if (cat === "overdue") {
        overdue++;
      } else if (cat === "in_progress") {
        inProgress++;
      } else {
        todo++;
      }
    }

    const rawItems = [
      {
        key: "in_progress" as const,
        label: "In-progress",
        count: inProgress,
        color: "#f43f5e",
        trackColor: "rgba(244, 63, 94, 0.16)",
        radius: 78,
        isArc: true,
      },
      {
        key: "overdue" as const,
        label: "Overdue",
        count: overdue,
        color: "#f59e0b",
        trackColor: "rgba(245, 158, 11, 0.16)",
        radius: 65,
        isArc: true,
      },
      {
        key: "completed" as const,
        label: "Completed",
        count: completed,
        color: "#3b82f6",
        trackColor: "rgba(59, 130, 246, 0.16)",
        radius: 52,
        isArc: true,
      },
      {
        key: "todo" as const,
        label: "To Do",
        count: todo,
        color: "#94a3b8",
        trackColor: "rgba(148, 163, 184, 0.2)",
        radius: 39,
        isArc: true,
      },
    ];

    // Ensure legend percentages strictly total 100% using largest remainder method
    let percentages = [0, 0, 0, 0];
    if (totalCount > 0) {
      const exact = rawItems.map((s) => (s.count / totalCount) * 100);
      const floors = exact.map(Math.floor);
      const diff = 100 - floors.reduce((a, b) => a + b, 0);

      const remainders = exact
        .map((val, idx) => ({
          idx,
          rem: val - (floors[idx] ?? 0),
          count: rawItems[idx]?.count ?? 0,
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

    const computedItems: StatusItem[] = rawItems.map((item, i) => ({
      ...item,
      percentage: percentages[i] ?? 0,
    }));

    return {
      total: totalCount,
      items: computedItems,
      hasData: totalCount > 0,
    };
  }, [tasks]);

  const arcItems = items.filter((item) => item.isArc);

  return (
    <div
      className={cn("surface-card p-5 flex flex-col justify-between transition-all", className)}
      aria-label="Task Status"
    >
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground tracking-tight">Task Status</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Task distribution by status</p>
      </div>

      {/* Content Body */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <div className="size-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-muted-foreground animate-pulse">Loading task statistics…</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="size-7 text-danger mb-2" />
          <p className="text-sm font-semibold text-foreground">Failed to load chart</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {errorMessage || "Unable to retrieve task metrics. Please refresh."}
          </p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col items-center justify-center w-full">
          {/* Upper/Center: Four concentric 270-degree open-ended arc gauge */}
          <div className="relative w-full max-w-70 h-47.5 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 220 155"
              className="w-full h-full overflow-visible select-none"
              aria-hidden="true"
            >
              {arcItems.map((item) => {
                const path = getArcPath(item.radius);
                const arcLength = getArcLength(item.radius);
                const ratio = total > 0 ? item.count / total : 0;
                const offset = mounted && item.count > 0 ? arcLength * (1 - ratio) : arcLength;
                const isHovered = hoveredKey === item.key;
                const isAnyHovered = hoveredKey !== null;

                return (
                  <g
                    key={item.key}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  >
                    {/* Background Track Arc (270° with bottom opening) */}
                    <path
                      d={path}
                      fill="none"
                      stroke={item.trackColor}
                      strokeWidth={6.5}
                      strokeLinecap="round"
                      className="transition-opacity duration-200"
                      opacity={isAnyHovered && !isHovered ? 0.4 : 1}
                    />

                    {/* Foreground Animated Segment */}
                    {hasData && item.count > 0 ? (
                      <path
                        d={path}
                        fill="none"
                        stroke={item.color}
                        strokeWidth={isHovered ? 8 : 6.5}
                        strokeLinecap="round"
                        strokeDasharray={`${arcLength} ${arcLength}`}
                        strokeDashoffset={offset}
                        className="transition-[stroke-dashoffset,stroke-width,opacity] duration-650 ease-out motion-reduce:transition-none"
                        opacity={isAnyHovered && !isHovered ? 0.35 : 1}
                      />
                    ) : null}
                  </g>
                );
              })}

              {/* Centered Total Task Count & Label */}
              <text
                x={CX}
                y={CY - 3}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground font-bold tabular-nums"
                style={{ fontSize: "24px", fontWeight: "700" }}
              >
                {total}
              </text>
              <text
                x={CX}
                y={CY + 15}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-muted-foreground font-medium"
                style={{ fontSize: "11px", fontWeight: "500" }}
              >
                Tasks
              </text>
            </svg>
          </div>

          {/* Accessible summary for screen reader users */}
          <p className="sr-only">
            Total tasks: {total}. Status breakdown:{" "}
            {items.map((item) => `${item.label}: ${item.count} (${item.percentage}%)`).join(", ")}
          </p>

          {/* Legend Below the Gauge: Semantic list with keyboard navigation */}
          <ul
            className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-5 gap-y-2 mt-3 pt-1 w-full list-none p-0 m-0"
            aria-label="Task status breakdown"
          >
            {items.map((item) => {
              const isHovered = hoveredKey === item.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => setHoveredKey(item.key)}
                    onBlur={() => setHoveredKey(null)}
                    onClick={() => setHoveredKey((prev) => (prev === item.key ? null : item.key))}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-all cursor-pointer px-2 py-1 rounded-md select-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      isHovered ? "bg-muted/70 ring-1 ring-border" : "hover:bg-muted/30",
                      item.count === 0 ? "opacity-60" : "opacity-100",
                    )}
                    aria-label={`${item.label}: ${item.count} tasks (${item.percentage}%)`}
                    title={`${item.label}: ${item.count} tasks (${item.percentage}%)`}
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="text-muted-foreground" aria-hidden="true">
                      -
                    </span>
                    <span className="font-semibold tabular text-foreground">{item.count}</span>
                    <span className="text-[11px] text-muted-foreground tabular" aria-hidden="true">
                      ({item.percentage}%)
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default TaskStatusDonutChart;
export type { TaskStatusDonutChartProps, StatusItem } from "./interface";
