import { AlertTriangle, CalendarClock, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/badges/status-badge";
import { statusOf } from "@/components/badges/utils";
import { CircularProgress } from "@/components/progress/circular-progress";
import { deadlineState, deadlineText } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import type { ProjectOverviewCardProps } from "./interface";

export function ProjectOverviewCard({ project, tasks, subtasks }: ProjectOverviewCardProps) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.is_completed).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdueCount = tasks.filter((t) => statusOf(t) === "overdue").length;

  const projectTaskIds = new Set(tasks.map((t) => t.id));
  const projectSubtasks = subtasks.filter((s) => projectTaskIds.has(s.task_id));
  const totalSubtasks = projectSubtasks.length;
  const doneSubtasks = projectSubtasks.filter((s) => s.is_completed).length;
  const subtaskPct = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

  const state = deadlineState({
    deadline: project.deadline,
    isCompleted: total > 0 && completed === total,
    completedAt: null,
  });

  return (
    <div className="surface-card rounded-2xl border border-border/80 p-5 shadow-xs transition-all">
      {/* Header: Overview & Target Deadline */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9.5 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">Project Summary</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {completed} of {total} tasks completed ({progress}%)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={state} />
          {project.deadline ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs sm:text-sm font-medium text-foreground shadow-xs">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              <span>{deadlineText(project.deadline)}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Circular Progress & Completion Overview */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <CircularProgress
            value={progress}
            size={50}
            strokeWidth={4.5}
            ariaLabel={`Project completion: ${progress}%`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-foreground">
                Completion Progress
              </span>
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                ({progress === 100 ? "Completed" : progress === 0 ? "Not started" : `${progress}%`})
              </span>
            </div>
            <p className="tabular text-xs sm:text-sm text-muted-foreground mt-0.5">
              {completed} of {total} tasks completed · {doneSubtasks} of {totalSubtasks} subtasks
              checked ({subtaskPct}%)
            </p>
          </div>
        </div>
        {overdueCount > 0 ? (
          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-danger-soft px-2.5 py-1 text-xs sm:text-sm font-semibold text-danger border border-danger/30 shrink-0">
            <AlertTriangle className="size-3.5" />
            <span>{overdueCount} overdue</span>
          </div>
        ) : null}
      </div>

      {/* Metric Chips */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-border/60 pt-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:p-3">
          <p className="text-xs sm:text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
            Tasks Done
          </p>
          <p className="tabular mt-0.5 text-base sm:text-lg font-bold text-foreground">
            {completed} / {total}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Subtasks Checked
          </p>
          <p className="tabular mt-0.5 text-base font-bold text-foreground">
            {doneSubtasks} / {totalSubtasks}{" "}
            <span className="text-xs font-normal text-muted-foreground">({subtaskPct}%)</span>
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Overdue Tasks
          </p>
          <p
            className={cn(
              "tabular mt-0.5 text-base font-bold",
              overdueCount > 0 ? "text-danger" : "text-foreground",
            )}
          >
            {overdueCount} {overdueCount === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>
    </div>
  );
}
