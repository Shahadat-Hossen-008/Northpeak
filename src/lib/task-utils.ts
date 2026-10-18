import { useMemo } from "react";
import { statusOf } from "@/components/badges/utils";
import { projectSlug } from "@/lib/utils";
import type { AppRole, Project, Subtask, Task } from "@/types";

export function getTaskFilterProjects(
  projects: Project[],
  tasks: Task[],
  userId: string | undefined,
  role: AppRole,
): Project[] {
  if (!userId) return [];
  if (role === "manager") return projects.filter((project) => project.manager_id === userId);
  const assignedProjectIds = new Set(
    tasks.filter((task) => task.assigned_developer_id === userId).map((task) => task.project_id),
  );
  return projects.filter((project) => assignedProjectIds.has(project.id));
}

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

const TASK_FILTER_STATUSES = ["open", "on_track", "due_soon", "overdue", "completed"] as const;
const TASK_FILTER_PRIORITIES = ["critical", "high", "medium", "low"] as const;
const TASK_FILTER_SORTS = ["deadline", "priority", "progress", "title"] as const;

export function taskFiltersFromSearch(search: Record<string, unknown>, manager: boolean): Filters {
  const status = search["status"];
  const priority = search["priority"];
  const sort = search["sort"];
  return {
    search: typeof search["q"] === "string" ? search["q"].trim() : "",
    project: typeof search["project"] === "string" && search["project"] ? search["project"] : "all",
    status:
      typeof status === "string" && (TASK_FILTER_STATUSES as readonly string[]).includes(status)
        ? status
        : "all",
    developer:
      manager &&
      typeof search["developer"] === "string" &&
      /^[a-f\d]{24}$/i.test(search["developer"])
        ? search["developer"]
        : "all",
    priority:
      typeof priority === "string" &&
      (TASK_FILTER_PRIORITIES as readonly string[]).includes(priority)
        ? priority
        : "all",
    sort:
      typeof sort === "string" && (TASK_FILTER_SORTS as readonly string[]).includes(sort)
        ? sort
        : "deadline",
  };
}

export function taskFiltersToSearch(
  filters: Filters,
  manager: boolean,
  projectName?: string,
): Record<string, string | undefined> {
  const search = filters.search.trim();
  return {
    q: search || undefined,
    project: filters.project !== "all" ? filters.project : undefined,
    projectName: filters.project !== "all" ? projectName : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    developer: manager && filters.developer !== "all" ? filters.developer : undefined,
    priority: filters.priority !== "all" ? filters.priority : undefined,
    sort: filters.sort !== "deadline" ? filters.sort : undefined,
  };
}

export function projectNameForTaskSearch(
  filters: Filters,
  projects: Project[],
): string | undefined {
  if (filters.project === "all") return undefined;
  const project = projects.find((item) => item.id === filters.project);
  return project ? projectSlug(project) : undefined;
}

export function taskMatchesSearch(task: Pick<Task, "title">, search: string): boolean {
  const term = search.trim().toLowerCase();
  return !term || task.title.toLowerCase().includes(term);
}

export function useFilteredTasks(
  tasks?: Task[] | null,
  subtasks?: Subtask[] | null,
  filtersInput?: Partial<Filters>,
) {
  const filters: Filters = {
    ...DEFAULT_FILTERS,
    ...filtersInput,
  };

  const result = useMemo(() => {
    const list = tasks ?? [];
    const subs = subtasks ?? [];
    let rows = list.filter((task) => {
      if (!taskMatchesSearch(task, filters.search)) return false;
      if (filters.project !== "all" && task.project_id !== filters.project) return false;
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
  }, [
    tasks,
    subtasks,
    filters.search,
    filters.project,
    filters.priority,
    filters.developer,
    filters.status,
    filters.sort,
  ]);

  return { filtered: result };
}
