import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { WORKFLOW_COLUMNS } from "@/components/badges/workflow-badge/columns";
import { TaskCard } from "@/sections/task-card";
import { useSetTaskCompletion, useUpdateTaskStatus } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { Task, TaskWorkflowStatus } from "@/types";
import type { TaskBoardProps } from "./interface";

export function TaskBoard({
  tasks,
  subtasks,
  commentCounts,
  hrefFor,
  onToggle,
  onMoveStatus,
  onAddTask,
}: TaskBoardProps) {
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
                "flex flex-col w-75 sm:w-[330px] md:w-[350px] shrink-0 rounded-xl border border-border/80 p-3.5 sm:p-4 transition-all min-h-125",
                column.columnBg,
                isDragOver ? "ring-2 ring-primary border-primary/50 bg-primary/8" : "",
              )}
            >
              {/* Column Header */}
              <header className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full shrink-0", column.dotColor)} />
                  <h3 className="text-xs sm:text-sm font-bold tracking-wider text-foreground uppercase">
                    {column.title}
                  </h3>
                </div>
                <span className="tabular rounded-full bg-card border border-border/60 px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-muted-foreground shadow-xs">
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
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                      {isDragOver ? "Release to drop task here" : "No tasks in this column"}
                    </p>
                    <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground/75">
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
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2.5 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground cursor-pointer"
                >
                  <Plus className="size-4" />
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

export default TaskBoard;
export type { TaskBoardProps } from "./interface";
