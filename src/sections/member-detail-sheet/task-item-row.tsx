import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Folder } from "lucide-react";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { StatusBadge } from "@/components/badges/status-badge";
import { CircularProgress } from "@/components/progress/circular-progress";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/deadline";
import type { DeadlineState, MemberWorkloadTask } from "@/types";

export function TaskItemRow({
  task,
  projectId,
  fromHref,
  onNavigate,
}: {
  task: MemberWorkloadTask;
  projectId?: string | null | undefined;
  fromHref?: string | undefined;
  onNavigate: () => void;
}) {
  const { role } = useAuth();
  const state = task.status as DeadlineState;
  const hasSubtasks = task.subtasks_count > 0;
  const subPercent = hasSubtasks
    ? Math.round((task.subtasks_completed_count / task.subtasks_count) * 100)
    : 0;
  const taskRoute = role === "developer" ? "/developer/tasks/$taskId" : "/manager/tasks/$taskId";

  return (
    <li>
      <Link
        to={taskRoute}
        params={{ taskId: task.id }}
        search={fromHref || projectId ? { from: fromHref ?? `/manager/projects/${projectId}` } : {}}
        onClick={onNavigate}
        title={`Open task: ${task.title}`}
        className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-card hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 max-w-full text-sm font-semibold text-foreground">
              <span className="relative inline-block pb-0.5 truncate text-foreground group-hover:text-primary transition-colors after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 after:ease-out group-hover:after:w-full">
                {task.title}
              </span>
              <ArrowUpRight className="size-4 text-primary shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>

            {task.project?.title ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Folder className="size-3.5 shrink-0" />
                <span className="truncate">{task.project.title}</span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={task.priority} />
            <StatusBadge state={state} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          <div>
            {task.deadline ? (
              <span className="flex items-center gap-1">
                <span>Due:</span>
                <span className="tabular font-medium text-foreground">
                  {formatDate(task.deadline)}
                </span>
                <DeadlineBadge deadline={task.deadline} state={state} />
              </span>
            ) : (
              <span>No deadline</span>
            )}
          </div>

          {hasSubtasks ? (
            <div className="flex items-center gap-2">
              <CircularProgress
                value={subPercent}
                size={22}
                strokeWidth={2.5}
                showValue={false}
                ariaLabel={`Subtasks progress: ${subPercent}%`}
              />
              <span className="tabular text-xs text-muted-foreground">
                {task.subtasks_completed_count}/{task.subtasks_count} subtasks
              </span>
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
