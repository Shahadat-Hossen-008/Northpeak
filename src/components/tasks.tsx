import { Link } from "@tanstack/react-router";
import {
  MessageSquare,
  ListChecks,
  Search,
  Trash2,
  ChevronDown,
  Check,
  GripVertical,
  Kanban,
  Table as TableIcon,
  Plus,
  FolderKanban,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DeadlineBadge,
  PriorityBadge,
  StatusBadge,
  borderForState,
  statusOf,
} from "@/components/badges";
import { EmptyState, ProgressBar, UserAvatar } from "@/components/primitives";
import {
  useSetTaskCompletion,
  useUpdateTaskStatus,
  type Member,
  type Project,
  type Subtask,
  type Task,
  type TaskWorkflowStatus,
} from "@/hooks/queries";
import { formatDate } from "@/lib/deadline";
import { cn, findProjectByIdOrSlug, slugify } from "@/lib/utils";

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

export type Filters = {
  search: string;
  project: string;
  status: string;
  developer: string;
  priority: string;
  sort: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  project: "all",
  status: "all",
  developer: "all",
  priority: "all",
  sort: "deadline",
};

export function useFilteredTasks(
  tasks: Task[],
  subtasks: Subtask[],
  initialFilters?: Partial<Filters>,
) {
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  }));

  useEffect(() => {
    if (initialFilters?.project && initialFilters.project !== "all") {
      setFilters((prev) => ({ ...prev, project: initialFilters.project! }));
    }
  }, [initialFilters?.project]);

  const result = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    let rows = tasks.filter((task) => {
      if (term && !`${task.title} ${task.project?.title ?? ""}`.toLowerCase().includes(term))
        return false;
      if (
        filters.project !== "all" &&
        task.project_id !== filters.project &&
        slugify(task.project?.title ?? "") !== filters.project.toLowerCase()
      )
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
  projects = [],
  showDeveloper = true,
  showProject = false,
}: {
  filters: Filters;
  setFilters: (next: Filters) => void;
  developers: Member[];
  projects?: Project[] | undefined;
  showDeveloper?: boolean | undefined;
  showProject?: boolean | undefined;
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
      {showProject && projects && projects.length > 0 ? (
        <Select
          value={findProjectByIdOrSlug(projects, filters.project)?.id ?? filters.project}
          onValueChange={(value) => setFilters({ ...filters, project: value })}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((proj) => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
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
                      className="font-semibold text-foreground hover:text-primary transition-colors"
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

export const WORKFLOW_COLUMNS: {
  key: TaskWorkflowStatus;
  title: string;
  dotColor: string;
  badgeStyle: string;
  borderHover: string;
  columnBg: string;
}[] = [
  {
    key: "todo",
    title: "To do",
    dotColor: "bg-muted-foreground",
    badgeStyle: "bg-secondary text-secondary-foreground border-border",
    borderHover: "hover:border-foreground/30",
    columnBg: "bg-secondary/40",
  },
  {
    key: "in_progress",
    title: "In progress",
    dotColor: "bg-primary",
    badgeStyle: "bg-primary/10 text-primary border-primary/30",
    borderHover: "hover:border-primary/50",
    columnBg: "bg-primary/[0.03]",
  },
  {
    key: "in_review",
    title: "QA review",
    dotColor: "bg-amber-500",
    badgeStyle: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    borderHover: "hover:border-amber-500/50",
    columnBg: "bg-amber-500/[0.03]",
  },
  {
    key: "done",
    title: "Done",
    dotColor: "bg-success",
    badgeStyle: "bg-success/10 text-success border-success/30",
    borderHover: "hover:border-success/50",
    columnBg: "bg-success/[0.03]",
  },
];

export function WorkflowStatusBadge({
  status,
  onSelect,
  disabled,
}: {
  status: TaskWorkflowStatus;
  onSelect?: ((status: TaskWorkflowStatus) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const current = WORKFLOW_COLUMNS.find((c) => c.key === status) ?? WORKFLOW_COLUMNS[0]!;

  if (!onSelect) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
          current.badgeStyle,
        )}
      >
        <span className={cn("size-1.5 rounded-full", current.dotColor)} />
        {current.title}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "group/status inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          current.badgeStyle,
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-85",
        )}
      >
        <span className={cn("size-1.5 rounded-full shrink-0", current.dotColor)} />
        <span>{current.title}</span>
        <ChevronDown className="size-3 opacity-60 transition-transform group-hover/status:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 p-1">
        {WORKFLOW_COLUMNS.map((col) => {
          const isSelected = col.key === status;
          return (
            <DropdownMenuItem
              key={col.key}
              onClick={() => onSelect(col.key)}
              className={cn(
                "flex items-center justify-between text-xs font-medium cursor-pointer py-1.5 px-2",
                isSelected ? "bg-accent text-accent-foreground font-semibold" : "",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", col.dotColor)} />
                {col.title}
              </span>
              {isSelected ? <Check className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskViewSwitcher({
  view,
  onViewChange,
}: {
  view: "board" | "table";
  onViewChange: (view: "board" | "table") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Task layout view"
      className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={view === "board"}
        onClick={() => onViewChange("board")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
          view === "board"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Kanban className="size-3.5" />
        Board
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === "table"}
        onClick={() => onViewChange("table")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
          view === "table"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <TableIcon className="size-3.5" />
        Table
      </button>
    </div>
  );
}

export function TaskCard({
  task,
  subtasks,
  href,
  commentCount = 0,
  onToggle,
  toggleDisabled,
  onMoveStatus,
  isDraggable,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  subtasks: Subtask[];
  href: string;
  commentCount?: number | undefined;
  onToggle?: ((completed: boolean) => void) | undefined;
  toggleDisabled?: boolean | undefined;
  onMoveStatus?: ((status: TaskWorkflowStatus) => void) | undefined;
  isDraggable?: boolean | undefined;
  onDragStart?: ((e: React.DragEvent) => void) | undefined;
  onDragEnd?: ((e: React.DragEvent) => void) | undefined;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const state = statusOf(task);
  const { done, total } = subtaskProgress(task.id, subtasks);
  const progress = taskProgress(task, subtasks);
  const currentWorkflowStatus: TaskWorkflowStatus =
    task.status ?? (task.is_completed ? "done" : "todo");

  return (
    <article
      draggable={isDraggable}
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        onDragEnd?.(e);
      }}
      className={cn(
        "surface-card group rounded-xl border p-3.5 transition-all duration-150 select-none shadow-xs",
        borderForState(state),
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-card hover:-translate-y-0.5 hover:border-primary/40"
          : "",
        isDragging ? "opacity-40 scale-[0.98] ring-2 ring-primary ring-offset-2" : "",
      )}
    >
      {/* Top Header: Grip Handle, Workflow Status Badge, and Toggle Checkbox */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isDraggable ? (
            <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors cursor-grab shrink-0">
              <GripVertical className="size-3.5" />
            </span>
          ) : null}
          <WorkflowStatusBadge status={currentWorkflowStatus} onSelect={onMoveStatus} />
        </div>
        {onToggle ? (
          <Checkbox
            checked={task.is_completed}
            disabled={toggleDisabled}
            aria-label={task.is_completed ? "Reopen task" : "Mark task complete"}
            onCheckedChange={(value) => onToggle(Boolean(value))}
            className="shrink-0"
          />
        ) : null}
      </div>

      {/* Title & Content: Natural vertical expansion */}
      <div className="space-y-1">
        <Link
          to={href}
          className="block font-semibold text-foreground hover:text-primary transition-colors text-sm leading-snug break-words"
        >
          {task.title}
        </Link>
        {task.description ? (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed break-words">
            {task.description}
          </p>
        ) : null}
        {task.project?.title ? (
          <div className="pt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FolderKanban className="size-3 text-muted-foreground/60 shrink-0" />
            <span className="truncate font-medium">{task.project.title}</span>
          </div>
        ) : null}
      </div>

      {/* Badges: Priority + Deadline Status */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <StatusBadge state={state} />
      </div>

      {/* Progress & Subtasks */}
      <div className="mt-3">
        <ProgressBar
          value={progress}
          tone={task.is_completed ? "success" : state === "overdue" ? "danger" : "primary"}
        />
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular">
            {total > 0 ? `${done}/${total} subtasks` : `${progress}%`}
          </span>
          <DeadlineBadge deadline={task.deadline} state={state} />
        </div>
      </div>

      {/* Footer: Assignee & Comments */}
      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5">
        {task.assignee ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <UserAvatar name={task.assignee.name} size="sm" />
            <span className="truncate">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
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
  onMoveStatus,
  onAddTask,
}: {
  tasks: Task[];
  subtasks: Subtask[];
  commentCounts: Record<string, number>;
  hrefFor: (task: Task) => string;
  onToggle?: ((task: Task, completed: boolean) => void) | undefined;
  onMoveStatus?: ((task: Task, newStatus: TaskWorkflowStatus) => void) | undefined;
  onAddTask?: ((status: TaskWorkflowStatus) => void) | undefined;
}) {
  const updateStatusMutation = useUpdateTaskStatus();
  const setCompletionMutation = useSetTaskCompletion();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskWorkflowStatus | null>(null);

  const handleToggle = (task: Task, completed: boolean) => {
    if (onToggle) {
      onToggle(task, completed);
    } else {
      setCompletionMutation.mutate({
        task: { id: task.id, title: task.title, project_id: task.project_id },
        completed,
      });
    }
  };

  const handleStatusChange = (task: Task, newStatus: TaskWorkflowStatus) => {
    if (onMoveStatus) {
      onMoveStatus(task, newStatus);
    } else {
      updateStatusMutation.mutate({ id: task.id, status: newStatus });
    }
  };

  const columns = useMemo(() => {
    const buckets: Record<TaskWorkflowStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };

    for (const task of tasks) {
      const status: TaskWorkflowStatus = task.status || (task.is_completed ? "done" : "todo");
      if (buckets[status]) {
        buckets[status].push(task);
      } else {
        buckets.todo.push(task);
      }
    }

    return WORKFLOW_COLUMNS.map((col) => ({
      ...col,
      tasks: buckets[col.key],
    }));
  }, [tasks]);

  return (
    <div className="w-full overflow-x-auto pb-6 pt-1 scroll-smooth">
      <div className="flex gap-4 sm:gap-5 min-w-max items-start">
        {columns.map((column) => {
          const isDragOver = dragOverColumn === column.key;

          return (
            <section
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverColumn !== column.key) {
                  setDragOverColumn(column.key);
                }
              }}
              onDragLeave={(e) => {
                const currentTarget = e.currentTarget;
                const relatedTarget = e.relatedTarget as Node | null;
                if (!currentTarget.contains(relatedTarget)) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColumn(null);
                const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
                if (taskId) {
                  const targetTask = tasks.find((t) => t.id === taskId);
                  if (targetTask && targetTask.status !== column.key) {
                    handleStatusChange(targetTask, column.key);
                  }
                }
                setDraggedTaskId(null);
              }}
              className={cn(
                "flex flex-col w-[300px] sm:w-[320px] md:w-[340px] shrink-0 rounded-xl border border-border/80 p-3.5 transition-all min-h-[500px]",
                column.columnBg,
                isDragOver ? "ring-2 ring-primary border-primary/50 bg-primary/[0.08]" : "",
              )}
            >
              {/* Column Header */}
              <header className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full shrink-0", column.dotColor)} />
                  <h3 className="text-xs font-bold tracking-wider text-foreground uppercase">
                    {column.title}
                  </h3>
                </div>
                <span className="tabular rounded-full bg-card border border-border/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground shadow-xs">
                  {column.tasks.length}
                </span>
              </header>

              {/* Column Task Cards */}
              <div className="flex-1 space-y-3">
                {column.tasks.length === 0 ? (
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 px-3 py-12 text-center transition-colors",
                      isDragOver ? "border-primary bg-primary/10" : "bg-card/40",
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {isDragOver ? "Release to drop task here" : "No tasks in this column"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Drag tasks here or use status menu
                    </p>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      subtasks={subtasks}
                      href={hrefFor(task)}
                      commentCount={commentCounts[task.id] ?? 0}
                      isDraggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                        setDraggedTaskId(task.id);
                      }}
                      onDragEnd={() => setDraggedTaskId(null)}
                      onToggle={(completed) => handleToggle(task, completed)}
                      toggleDisabled={setCompletionMutation.isPending}
                      onMoveStatus={(newStatus) => handleStatusChange(task, newStatus)}
                    />
                  ))
                )}
              </div>

              {/* Quick Add Button */}
              {onAddTask ? (
                <button
                  type="button"
                  onClick={() => onAddTask(column.key)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add task
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
