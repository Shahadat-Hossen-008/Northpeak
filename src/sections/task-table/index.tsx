import { Link } from "@tanstack/react-router";
import { ListChecks, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { StatusBadge } from "@/components/badges/status-badge";
import { statusOf } from "@/components/badges/utils";
import { CircularProgress } from "@/components/progress/circular-progress";
import { EmptyState } from "@/components/feedback/empty-state";
import { UserAvatar } from "@/components/avatar";
import { TaskCard } from "@/sections/task-card";
import { formatDate } from "@/lib/deadline";
import { subtaskProgress, taskProgress } from "@/lib/task-utils";
import type { TaskTableProps } from "./interface";

export function TaskTable({ tasks, subtasks, hrefFor, onDelete }: TaskTableProps) {
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
        <table className="w-full text-sm sm:text-base">
          <thead>
            <tr className="border-b border-border text-left text-xs sm:text-sm tracking-wider text-muted-foreground uppercase">
              <th className="px-3.5 py-3.5 font-semibold">Task</th>
              <th className="px-3.5 py-3.5 font-semibold">Developer</th>
              <th className="px-3.5 py-3.5 font-semibold">Priority</th>
              <th className="px-3.5 py-3.5 font-semibold">Deadline</th>
              <th className="px-3.5 py-3.5 font-semibold">Progress</th>
              <th className="px-3.5 py-3.5 font-semibold">Status</th>
              <th className="px-3.5 py-3.5 text-right font-semibold">Actions</th>
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
                  <td className="px-3.5 py-3.5">
                    <Link
                      to={hrefFor(task)}
                      className="font-semibold text-foreground hover:text-primary transition-colors text-sm sm:text-base"
                    >
                      {task.title}
                    </Link>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {task.project?.title}
                    </p>
                  </td>
                  <td className="px-3.5 py-3.5">
                    {task.assignee ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar name={task.assignee.name} size="sm" />
                        <span className="text-sm sm:text-base">{task.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-sm sm:text-base text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-3.5 py-3.5">
                    <span className="tabular block text-sm sm:text-base">
                      {formatDate(task.deadline)}
                    </span>
                    <DeadlineBadge deadline={task.deadline} state={state} />
                  </td>
                  <td className="px-3.5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <CircularProgress
                        value={progress}
                        size={36}
                        strokeWidth={4}
                        ariaLabel={`Progress: ${progress}%`}
                      />
                      <div className="min-w-0">
                        <span className="tabular text-xs sm:text-sm font-semibold text-foreground block">
                          {task.is_completed
                            ? "100% complete"
                            : total > 0
                              ? `${done}/${total} subtasks`
                              : `${progress}%`}
                        </span>
                        <span className="text-xs sm:text-[13px] text-muted-foreground block">
                          {task.is_completed
                            ? "Completed"
                            : progress > 0
                              ? "In progress"
                              : "Not started"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge state={state} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={hrefFor(task)}>Open</Link>
                      </Button>
                      {onDelete ? (
                        <Button
                          variant="destructive-outline"
                          size="icon-sm"
                          aria-label={`Delete ${task.title}`}
                          title={`Delete ${task.title}`}
                          onClick={() => onDelete(task)}
                        >
                          <Trash2 className="size-3.5" />
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

export default TaskTable;
export type { TaskTableProps } from "./interface";
