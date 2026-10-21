import { Link } from "@tanstack/react-router";
import { CheckSquare, ListTodo, MessageSquare, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { statusOf } from "@/components/badges/utils";
import { EmptyState } from "@/components/feedback/empty-state";
import { UserAvatar } from "@/components/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetTaskCompletion } from "@/hooks/queries";
import { formatDate } from "@/lib/deadline";
import { subtaskProgress } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { ProjectTasksListProps } from "./interface";

export function ProjectTasksList({
  tasks,
  subtasks,
  commentCounts,
  hrefFor,
  renderAddTask,
}: ProjectTasksListProps) {
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
                        "font-semibold text-sm hover:text-primary transition-colors block wrap-break-word",
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
                      <span className="text-xs text-muted-foreground max-w-25 truncate hidden md:inline">
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
