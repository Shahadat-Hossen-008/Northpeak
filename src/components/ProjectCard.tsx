import { Link } from "@tanstack/react-router";

import { PriorityBadge, StatusBadge, borderForState } from "@/components/badges";
import { ProgressBar } from "@/components/primitives";
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
          <Link to={href} className="text-base font-bold text-foreground hover:text-primary">
            {project.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        </div>
        <PriorityBadge priority={project.priority} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">{stats.progress}% complete</span>
          <span className="tabular text-muted-foreground">
            {stats.completed} / {stats.total} tasks
          </span>
        </div>
        <ProgressBar
          value={stats.progress}
          tone={stats.allDone ? "success" : stats.overdue > 0 ? "danger" : "primary"}
        />
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
