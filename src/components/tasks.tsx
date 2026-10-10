import { Link } from "@tanstack/react-router";
import { MessageSquare, ListChecks, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DeadlineBadge,
  PriorityBadge,
  StatusBadge,
  borderForState,
  statusOf,
} from "@/components/badges";
import { EmptyState, ProgressBar, UserAvatar } from "@/components/primitives";
import type { Member, Subtask, Task } from "@/hooks/queries";
import { formatDate } from "@/lib/deadline";
import { cn } from "@/lib/utils";

export function subtaskProgress(taskId: string, subtasks: Subtask[]) {
  const mine = subtasks.filter((s) => s.task_id === taskId);
  const done = mine.filter((s) => s.is_completed).length;
  return { done, total: mine.length };
}

export function taskProgress(task: Task, subtasks: Subtask[]): number {
  if (task.is_completed) return 100;
  const { done, total } = subtaskProgress(task.id, subtasks);
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

type Filters = {
  search: string;
  status: string;
  developer: string;
  priority: string;
  sort: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "all",
  developer: "all",
  priority: "all",
  sort: "deadline",
};

export function useFilteredTasks(tasks: Task[], subtasks: Subtask[]) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const result = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    let rows = tasks.filter((task) => {
      if (term && !`${task.title} ${task.project?.title ?? ""}`.toLowerCase().includes(term))
        return false;
      if (filters.priority !== "all" && task.priority !== filters.priority) return false;
      if (filters.developer !== "all" && task.assigned_developer_id !== filters.developer)
        return false;
      if (filters.status !== "all") {
        const state = statusOf(task);
        if (filters.status === "completed" && !task.is_completed) return false;
        if (filters.status === "open" && task.is_completed) return false;
        if (filters.status === "overdue" && state !== "overdue") return false;
        if (filters.status === "due_soon" && state !== "due_soon") return false;
        if (filters.status === "on_track" && state !== "on_track") return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (filters.sort === "priority") {
        const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        return order[a.priority] - order[b.priority];
      }
      if (filters.sort === "progress") {
        return taskProgress(b, subtasks) - taskProgress(a, subtasks);
      }
      if (filters.sort === "title") return a.title.localeCompare(b.title);
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return rows;
  }, [tasks, subtasks, filters]);

  return { filters, setFilters, filtered: result };
}

export function TaskFilters({
  filters,
  setFilters,
  developers,
  showDeveloper = true,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  developers: Member[];
  showDeveloper?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-56">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search tasks or projects"
          className="pl-9"
          aria-label="Search tasks"
        />
      </div>
      <Select
        value={filters.status}
        onValueChange={(value) => setFilters({ ...filters, status: value })}
      >
        <SelectTrigger className="sm:w-40" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="on_track">On track</SelectItem>
          <SelectItem value="due_soon">Due soon</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      {showDeveloper ? (
        <Select
          value={filters.developer}
          onValueChange={(value) => setFilters({ ...filters, developer: value })}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by developer">
            <SelectValue placeholder="Developer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All developers</SelectItem>
            {developers.map((dev) => (
              <SelectItem key={dev.id} value={dev.id}>
                {dev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={filters.priority}
        onValueChange={(value) => setFilters({ ...filters, priority: value })}
      >
        <SelectTrigger className="sm:w-36" aria-label="Filter by priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.sort}
        onValueChange={(value) => setFilters({ ...filters, sort: value })}
      >
        <SelectTrigger className="sm:w-40" aria-label="Sort tasks">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="deadline">Sort: deadline</SelectItem>
          <SelectItem value="priority">Sort: priority</SelectItem>
          <SelectItem value="progress">Sort: progress</SelectItem>
          <SelectItem value="title">Sort: title</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function TaskTable({
  tasks,
  subtasks,
  hrefFor,
  onDelete,
}: {
  tasks: Task[];
  subtasks: Subtask[];
  hrefFor: (task: Task) => string;
  onDelete?: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No tasks match these filters"
        description="Try clearing the search or choosing a different status."
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-3 font-semibold">Task</th>
              <th className="px-3 py-3 font-semibold">Developer</th>
              <th className="px-3 py-3 font-semibold">Priority</th>
              <th className="px-3 py-3 font-semibold">Deadline</th>
              <th className="px-3 py-3 font-semibold">Progress</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const state = statusOf(task);
              const { done, total } = subtaskProgress(task.id, subtasks);
              const progress = taskProgress(task, subtasks);
              return (
                <tr
                  key={task.id}
                  className="border-b border-border/70 last:border-0 hover:bg-secondary/60"
                >
                  <td className="px-3 py-3">
                    <Link
                      to={hrefFor(task)}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      {task.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{task.project?.title}</p>
                  </td>
                  <td className="px-3 py-3">
                    {task.assignee ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar name={task.assignee.name} size="sm" />
                        <span className="text-sm">{task.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <span className="tabular block text-sm">{formatDate(task.deadline)}</span>
                    <DeadlineBadge deadline={task.deadline} state={state} />
                  </td>
                  <td className="px-3 py-3 w-40">
                    <ProgressBar
                      value={progress}
                      tone={
                        task.is_completed ? "success" : state === "overdue" ? "danger" : "primary"
                      }
                    />
                    <span className="tabular mt-1 block text-xs text-muted-foreground">
                      {total > 0 ? `${done}/${total} subtasks` : `${progress}%`}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge state={state} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={hrefFor(task)}>Open</Link>
                      </Button>
                      {onDelete ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${task.title}`}
                          onClick={() => onDelete(task)}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} subtasks={subtasks} href={hrefFor(task)} />
        ))}
      </div>
    </>
  );
}

export function TaskCard({
  task,
  subtasks,
  href,
  commentCount = 0,
  onToggle,
  toggleDisabled,
}: {
  task: Task;
  subtasks: Subtask[];
  href: string;
  commentCount?: number;
  onToggle?: ((completed: boolean) => void) | undefined;
  toggleDisabled?: boolean;
}) {
  const state = statusOf(task);
  const { done, total } = subtaskProgress(task.id, subtasks);
  const progress = taskProgress(task, subtasks);

  return (
    <article className={cn("surface-card border p-4", borderForState(state))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={href} className="block font-semibold text-foreground hover:text-primary">
            {task.title}
          </Link>
          <p className="text-xs text-muted-foreground">{task.project?.title}</p>
        </div>
        {onToggle ? (
          <Checkbox
            checked={task.is_completed}
            disabled={toggleDisabled}
            aria-label={task.is_completed ? "Reopen task" : "Mark task complete"}
            onCheckedChange={(value) => onToggle(Boolean(value))}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        <StatusBadge state={state} />
      </div>

      <div className="mt-3">
        <ProgressBar
          value={progress}
          tone={task.is_completed ? "success" : state === "overdue" ? "danger" : "primary"}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular">
            {total > 0 ? `${done}/${total} subtasks` : `${progress}%`}
          </span>
          <DeadlineBadge deadline={task.deadline} state={state} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {task.assignee ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar name={task.assignee.name} size="sm" />
            {task.assignee.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5" aria-hidden />
          {commentCount}
        </span>
      </div>
    </article>
  );
}

export function TaskBoard({
  tasks,
  subtasks,
  commentCounts,
  hrefFor,
  onToggle,
}: {
  tasks: Task[];
  subtasks: Subtask[];
  commentCounts: Record<string, number>;
  hrefFor: (task: Task) => string;
  onToggle?: (task: Task, completed: boolean) => void;
}) {
  const columns = useMemo(() => {
    const todo: Task[] = [];
    const inProgress: Task[] = [];
    const completed: Task[] = [];
    for (const task of tasks) {
      if (task.is_completed) completed.push(task);
      else {
        const { done, total } = subtaskProgress(task.id, subtasks);
        if (total > 0 && done > 0) inProgress.push(task);
        else todo.push(task);
      }
    }
    return [
      { key: "todo", title: "To do", tasks: todo },
      { key: "progress", title: "In progress", tasks: inProgress },
      { key: "done", title: "Completed", tasks: completed },
    ];
  }, [tasks, subtasks]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => (
        <section key={column.key} className="rounded-xl bg-secondary/60 p-3">
          <header className="flex items-center justify-between px-1 pb-3">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {column.title}
            </h3>
            <span className="tabular rounded-full bg-card px-2 py-0.5 text-xs font-semibold">
              {column.tasks.length}
            </span>
          </header>
          <div className="space-y-3">
            {column.tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing here
              </p>
            ) : (
              column.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subtasks={subtasks}
                  href={hrefFor(task)}
                  commentCount={commentCounts[task.id] ?? 0}
                  onToggle={onToggle ? (completed) => onToggle(task, completed) : undefined}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
