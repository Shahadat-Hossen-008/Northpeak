import type { DeadlineState } from "@/types/frontend";
import type { ComputedPrototypeTask, PrototypeTask, SimulationMetrics } from "./interface";

export function calculateDeadlineState(
  task: PrototypeTask,
  currentSprintDay: number,
): DeadlineState {
  if (task.workflowState === "done") {
    const finishedDay = task.completedAtDay ?? task.dueDay;
    return finishedDay <= task.dueDay ? "completed_on_time" : "completed_late";
  }

  const daysRemaining = task.dueDay - currentSprintDay;
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 3) return "due_soon";
  return "on_track";
}

export function computeTaskProgress(
  task: PrototypeTask,
  currentSprintDay: number,
): ComputedPrototypeTask {
  const deadlineState = calculateDeadlineState(task, currentSprintDay);
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const progressPercent =
    task.subtasks.length > 0
      ? Math.round((completedSubtasks / task.subtasks.length) * 100)
      : task.workflowState === "done"
        ? 100
        : 0;

  return {
    ...task,
    deadlineState,
    completedSubtasks,
    progressPercent,
  };
}

export function computeTaskMetrics(tasks: ComputedPrototypeTask[]): SimulationMetrics {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.workflowState === "done").length;
  const overdue = tasks.filter((t) => t.deadlineState === "overdue").length;
  const dueSoon = tasks.filter((t) => t.deadlineState === "due_soon").length;
  const onTrack = tasks.filter((t) => t.deadlineState === "on_track").length;
  const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, overdue, dueSoon, onTrack, overallProgress };
}
