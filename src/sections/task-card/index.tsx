import { Link } from "@tanstack/react-router";
import { FolderKanban, GripVertical, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { StatusBadge } from "@/components/badges/status-badge";
import { WorkflowStatusBadge } from "@/components/badges/workflow-badge";
import { borderForState, statusOf } from "@/components/badges/utils";
import { CircularProgress } from "@/components/progress/circular-progress";
import { UserAvatar } from "@/components/avatar";
import { subtaskProgress, taskProgress } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import type { TaskWorkflowStatus } from "@/types";
import type { TaskCardProps } from "./interface";

export function TaskCard({
  task,
  subtasks = [],
  href = "#",
  commentCount = 0,
  onToggle,
  toggleDisabled,
  onMoveStatus,
  isDraggable,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
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
        "surface-card group rounded-xl border p-4 sm:p-4.5 transition-all duration-150 select-none shadow-xs",
        borderForState(state),
        isDraggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-card hover:-translate-y-0.5 hover:border-primary/40"
          : "",
        isDragging ? "opacity-40 scale-[0.98] ring-2 ring-primary ring-offset-2" : "",
      )}
    >
      {/* Top Header: Grip Handle, Workflow Status Badge, and Toggle Checkbox */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isDraggable ? (
            <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors cursor-grab shrink-0">
              <GripVertical className="size-4" />
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
      <div className="space-y-1.5">
        <Link
          to={href}
          className="block font-semibold text-foreground hover:text-primary transition-colors text-sm sm:text-base leading-snug wrap-break-word"
        >
          {task.title}
        </Link>
        {task.description ? (
          <p className="text-xs sm:text-sm text-muted-foreground/85 line-clamp-2 leading-relaxed wrap-break-word">
            {task.description}
          </p>
        ) : null}
        {task.project?.title ? (
          <div className="pt-0.5 flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
            <FolderKanban className="size-3.5 text-muted-foreground/60 shrink-0" />
            <span className="truncate font-medium">{task.project.title}</span>
          </div>
        ) : null}
      </div>

      {/* Badges: Priority + Deadline Status */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <StatusBadge state={state} />
      </div>

      {/* Progress & Subtasks */}
      <div className="mt-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CircularProgress
            value={progress}
            size={28}
            strokeWidth={3.5}
            showValue={false}
            ariaLabel={`Progress: ${progress}%`}
          />
          <span className="tabular text-xs sm:text-sm font-medium text-muted-foreground truncate">
            {total > 0 ? `${done}/${total} subtasks` : `${progress}%`}
          </span>
        </div>
        <DeadlineBadge deadline={task.deadline} state={state} />
      </div>

      {/* Footer: Assignee & Comments */}
      <div className="mt-3.5 flex items-center justify-between border-t border-border/70 pt-2.5">
        {task.assignee ? (
          <span className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground min-w-0">
            <UserAvatar name={task.assignee.name} size="sm" />
            <span className="truncate">{task.assignee.name}</span>
          </span>
        ) : (
          <span className="text-xs sm:text-sm text-muted-foreground">Unassigned</span>
        )}
        <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground shrink-0">
          <MessageSquare className="size-3.5" aria-hidden />
          {commentCount}
        </span>
      </div>
    </article>
  );
}

export default TaskCard;
export type { TaskCardProps } from "./interface";
