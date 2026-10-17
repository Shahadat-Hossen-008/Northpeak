import { Link } from "@tanstack/react-router";
import { CalendarClock, GripVertical, MessageSquare } from "lucide-react";
import { useState } from "react";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { borderForState, statusOf } from "@/components/badges/utils";
import { UserAvatar } from "@/components/avatar";
import { formatDate } from "@/lib/deadline";
import { subtaskProgress } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { TaskCardProps } from "./interface";

export function TaskCard({
  task,
  subtasks = [],
  href = "#",
  commentCount = 0,
  isDraggable,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const state = statusOf(task);
  const { done, total } = subtaskProgress(task.id, subtasks);

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
        "surface-card group rounded-xl border p-3.5 sm:p-4 transition-all duration-150 select-none shadow-xs",
        borderForState(state),
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-card hover:-translate-y-0.5 hover:border-primary/40"
          : "",
        isDragging ? "opacity-40 scale-[0.98] ring-2 ring-primary ring-offset-2" : "",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {isDraggable ? (
          <span className="text-muted-foreground/40 transition-colors group-hover:text-muted-foreground cursor-grab shrink-0">
            <GripVertical className="size-4" aria-hidden />
          </span>
        ) : null}
        {task.project?.title ? (
          <span className="truncate text-xs font-medium text-muted-foreground">
            {task.project.title}
          </span>
        ) : null}
      </div>

      <div>
        <Link
          to={href}
          className="block font-semibold leading-snug text-sm sm:text-base text-foreground transition-colors hover:text-primary wrap-break-word"
        >
          {task.title}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {task.priority ? <PriorityBadge priority={task.priority} /> : null}
        {task.deadline ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium",
              state === "overdue"
                ? "text-danger"
                : state === "due_soon"
                  ? "text-warning-foreground"
                  : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
            {formatDate(task.deadline)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
        {task.assignee ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UserAvatar name={task.assignee.name} size="sm" />
            <span className="truncate">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="truncate text-xs text-muted-foreground">Unassigned</span>
        )}
        {total > 0 || commentCount > 0 ? (
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {total > 0 ? `${done}/${total} subtasks` : null}
            {commentCount > 0 ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3.5" aria-hidden />
                {commentCount}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default TaskCard;
export type { TaskCardProps } from "./interface";
