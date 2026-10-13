import { useEffect, useMemo, useState } from "react";
import { statusOf } from "@/components/badges/utils";
import { slugify } from "@/lib/utils";
import type { Subtask, Task } from "@/types";

export function subtaskProgress(taskId: string, subtasks?: Subtask[] | null) {
  const mine = (subtasks ?? []).filter((s) => s.task_id === taskId);
  const done = mine.filter((s) => s.is_completed).length;
  return { done, total: mine.length };
}

export function isTaskCompleted(task: { is_completed: boolean; status?: string | null }): boolean {
  return Boolean(task.is_completed || task.status === "done");
}

export function isTaskOverdue(
  task: {
    deadline: string | null;
    is_completed: boolean;
    completed_at: string | null;
    status?: string | null;
  },
  now: Date = new Date(),
): boolean {
  if (isTaskCompleted(task)) return false;
  const currentDate = now instanceof Date ? now : new Date();
  return statusOf(task, currentDate) === "overdue";
}

export type TaskCategory = "completed" | "overdue" | "in_progress" | "todo";

export function getTaskCategory(
  task: {
    deadline: string | null;
    is_completed: boolean;
    completed_at: string | null;
    status?: string | null;
  },
  now: Date = new Date(),
): TaskCategory {
  const currentDate = now instanceof Date ? now : new Date();
  if (isTaskCompleted(task)) return "completed";
  if (isTaskOverdue(task, currentDate)) return "overdue";
  if (task.status === "in_progress" || task.status === "in_review") return "in_progress";
  return "todo";
}

export function taskProgress(task: Task, subtasks?: Subtask[] | null): number {
  if (isTaskCompleted(task)) return 100;
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

export const DEFAULT_FILTERS: Filters = {
  search: "",
  project: "all",
  status: "all",
  developer: "all",
  priority: "all",
  sort: "deadline",
};

export function useFilteredTasks(
  tasks?: Task[] | null,
  subtasks?: Subtask[] | null,
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
    const list = tasks ?? [];
    const subs = subtasks ?? [];
    const term = filters.search.trim().toLowerCase();
    let rows = list.filter((task) => {
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
        return taskProgress(b, subs) - taskProgress(a, subs);
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
