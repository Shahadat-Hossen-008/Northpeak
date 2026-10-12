import { deadlineState } from "@/lib/deadline";
import type { DeadlineState, Project, Task } from "@/types";

export function projectStats(
  project: Project,
  tasks?: Task[] | null,
): {
  total: number;
  completed: number;
  overdue: number;
  progress: number;
  state: DeadlineState;
  allDone: boolean;
} {
  const list = tasks ?? [];
  const projectTasks = list.filter((task) => task.project_id === project.id);
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
