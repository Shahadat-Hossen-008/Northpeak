import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ListTodo,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DeadlineBadge, PriorityBadge, StatusBadge, statusOf } from "@/components/badges";
import { CircularProgress } from "@/components/CircularProgress";
import { EmptyState, ProgressBar, UserAvatar } from "@/components/primitives";
import { subtaskProgress } from "@/components/tasks";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSetTaskCompletion,
  type Priority,
  type Project,
  type Subtask,
  type Task,
} from "@/hooks/queries";
import { deadlineState, deadlineText, formatDate } from "@/lib/deadline";
import { cn } from "@/lib/utils";

export function ProjectOverviewCard({
  project,
  tasks,
  subtasks,
}: {
  project: Project;
  tasks: Task[];
  subtasks: Subtask[];
}) {
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
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Project Summary</h3>
            <p className="text-xs text-muted-foreground">
              {completed} of {total} tasks completed ({progress}%)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge state={state} />
          {project.deadline ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-xs">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              <span>{deadlineText(project.deadline)}</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Circular Progress & Completion Overview */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-3.5">
        <div className="flex items-center gap-3.5 min-w-0">
          <CircularProgress
            value={progress}
            size={48}
            strokeWidth={4.5}
            ariaLabel={`Project completion: ${progress}%`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">Completion Progress</span>
              <span className="text-xs font-semibold text-muted-foreground">
                ({progress === 100 ? "Completed" : progress === 0 ? "Not started" : `${progress}%`})
              </span>
            </div>
            <p className="tabular text-xs text-muted-foreground mt-0.5">
              {completed} of {total} tasks completed · {doneSubtasks} of {totalSubtasks} subtasks
              checked ({subtaskPct}%)
            </p>
          </div>
        </div>
        {overdueCount > 0 ? (
          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger border border-danger/30 shrink-0">
            <AlertTriangle className="size-3.5" />
            <span>{overdueCount} overdue</span>
          </div>
        ) : null}
      </div>

      {/* Metric Chips */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-border/60 pt-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Tasks Done
          </p>
          <p className="tabular mt-0.5 text-base font-bold text-foreground">
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

export function ProjectTasksList({
  tasks,
  subtasks,
  commentCounts,
  hrefFor,
  renderAddTask,
}: {
  tasks: Task[];
  subtasks: Subtask[];
  commentCounts: Record<string, number>;
  hrefFor: (task: Task) => string;
  renderAddTask?: React.ReactNode | undefined;
}) {
  const setCompletion = useSetTaskCompletion();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "due_soon" | "overdue" | "completed"
  >("all");

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (term && !task.title.toLowerCase().includes(term)) {
        return false;
      }
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (statusFilter !== "all") {
        const state = statusOf(task);
        if (statusFilter === "open" && task.is_completed) return false;
        if (statusFilter === "completed" && !task.is_completed) return false;
        if (statusFilter === "due_soon" && state !== "due_soon") return false;
        if (statusFilter === "overdue" && state !== "overdue") return false;
      }
      return true;
    });
  }, [tasks, search, priorityFilter, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by task title..."
              className="pl-9 h-9 text-xs"
              aria-label="Search by task title"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) =>
              setStatusFilter(val as "all" | "open" | "due_soon" | "overdue" | "completed")
            }
          >
            <SelectTrigger className="sm:w-36 h-9 text-xs" aria-label="Filter by status">
              <SelectValue placeholder="All tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="sm:w-36 h-9 text-xs" aria-label="Filter by priority">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {renderAddTask ? renderAddTask : null}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks match criteria"
          description="Try adjusting your search or filter settings."
        />
      ) : (
        <div className="rounded-xl border border-border/80 bg-card/60 divide-y divide-border/60 overflow-hidden shadow-xs">
          {filteredTasks.map((task) => {
            const state = statusOf(task);
            const { done, total } = subtaskProgress(task.id, subtasks);
            const comments = commentCounts[task.id] ?? 0;

            return (
              <div
                key={task.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 transition-colors hover:bg-muted/40"
              >
                {/* Left: Checkbox, Title & Description */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={(val) =>
                      setCompletion.mutate({
                        task,
                        completed: Boolean(val),
                      })
                    }
                    aria-label={task.is_completed ? "Reopen task" : "Mark task complete"}
                    className="mt-1 sm:mt-0 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={hrefFor(task)}
                      className={cn(
                        "font-semibold text-sm hover:text-primary transition-colors block break-words",
                        task.is_completed
                          ? "line-through text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {task.title}
                    </Link>
                    {task.description ? (
                      <p className="text-xs text-muted-foreground/75 truncate mt-0.5">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Right: Badges, Subtasks, Assignee, Deadline */}
                <div className="flex flex-wrap items-center gap-2.5 sm:justify-end shrink-0 pl-7 sm:pl-0">
                  <PriorityBadge priority={task.priority} />

                  {total > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md font-medium">
                      <CheckSquare className="size-3 text-muted-foreground/80" />
                      <span className="tabular">
                        {done}/{total}
                      </span>
                    </span>
                  ) : null}

                  {task.deadline ? (
                    <div className="flex items-center gap-1.5">
                      <span className="tabular text-xs text-muted-foreground hidden lg:inline">
                        {formatDate(task.deadline)}
                      </span>
                      <DeadlineBadge deadline={task.deadline} state={state} />
                    </div>
                  ) : null}

                  {task.assignee ? (
                    <div className="flex items-center gap-1.5" title={task.assignee.name}>
                      <UserAvatar name={task.assignee.name} size="sm" />
                      <span className="text-xs text-muted-foreground max-w-[100px] truncate hidden md:inline">
                        {task.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      Unassigned
                    </span>
                  )}

                  {comments > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="size-3" />
                      {comments}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
