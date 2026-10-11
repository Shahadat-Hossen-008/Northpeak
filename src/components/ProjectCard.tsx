import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { PriorityBadge, StatusBadge, borderForState } from "@/components/badges";
import { CircularProgress } from "@/components/CircularProgress";
import type { Project, Task } from "@/hooks/queries";
import { deadlineState, formatDate } from "@/lib/deadline";
import { cn } from "@/lib/utils";

export function projectStats(project: Project, tasks: Task[]) {
  const projectTasks = tasks.filter((task) => task.project_id === project.id);
  const completed = projectTasks.filter((task) => task.is_completed).length;
  const overdue = projectTasks.filter(
    (task) => !task.is_completed && task.deadline && new Date(task.deadline) < new Date(),
  ).length;
  const progress =
    projectTasks.length === 0 ? 0 : Math.round((completed / projectTasks.length) * 100);
  const allDone = projectTasks.length > 0 && completed === projectTasks.length;
  const state = deadlineState({
    deadline: project.deadline,
    isCompleted: allDone,
    completedAt: null,
  });
  return { total: projectTasks.length, completed, overdue, progress, state, allDone };
}

export function ProjectCard({
  project,
  tasks,
  href,
}: {
  project: Project;
  tasks: Task[];
  href: string;
}) {
  const stats = projectStats(project, tasks);

  return (
    <article className={cn("surface-card flex flex-col border p-5", borderForState(stats.state))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={href}
            className="project-title-link text-base font-bold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
          >
            <span className="project-title-text">
              {project.title}
            </span>
            <ArrowUpRight
              className="project-redirect-icon size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        </div>
        <PriorityBadge priority={project.priority} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center gap-3 min-w-0">
          <CircularProgress
            value={stats.progress}
            size={40}
            strokeWidth={4}
            ariaLabel={`Project completion: ${stats.progress}%`}
          />
          <div className="min-w-0">
            <span className="font-semibold text-xs text-foreground block truncate">
              {stats.allDone ? "All tasks completed" : `${stats.progress}% complete`}
            </span>
            <p className="tabular text-[11px] text-muted-foreground">
              {stats.completed} of {stats.total} tasks
            </p>
          </div>
        </div>
        {stats.overdue > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger border border-danger/30 shrink-0">
            {stats.overdue} overdue
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Deadline</p>
          <p className="tabular text-sm font-semibold">{formatDate(project.deadline)}</p>
        </div>
        <StatusBadge state={stats.state} />
      </div>
    </article>
  );
}
