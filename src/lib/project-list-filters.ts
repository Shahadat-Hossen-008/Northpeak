import type { DeadlineState } from "@/lib/deadline";
import { projectStats } from "@/lib/project-utils";
import type { Priority, Project, Task } from "@/types";

export type ProjectListFilters = {
  search: string;
  priority: Priority | "all";
  status: DeadlineState | "all";
};

export const DEFAULT_PROJECT_LIST_FILTERS: ProjectListFilters = {
  search: "",
  priority: "all",
  status: "all",
};

const priorities: readonly Priority[] = ["critical", "high", "medium", "low"];
const states: readonly DeadlineState[] = [
  "completed_on_time",
  "completed_late",
  "overdue",
  "due_soon",
  "on_track",
  "no_deadline",
];

export function projectListFiltersFromSearch(search: Record<string, unknown>): ProjectListFilters {
  return {
    search: typeof search["q"] === "string" ? search["q"].trim() : "",
    priority:
      typeof search["priority"] === "string" && priorities.includes(search["priority"] as Priority)
        ? (search["priority"] as Priority)
        : "all",
    status:
      typeof search["status"] === "string" && states.includes(search["status"] as DeadlineState)
        ? (search["status"] as DeadlineState)
        : "all",
  };
}

export function projectListFiltersToSearch(filters: ProjectListFilters) {
  return {
    q: filters.search.trim() || undefined,
    priority: filters.priority === "all" ? undefined : filters.priority,
    status: filters.status === "all" ? undefined : filters.status,
  };
}

export function filterProjects(
  projects: Project[],
  tasks: Task[],
  filters: ProjectListFilters,
): Project[] {
  const query = filters.search.trim().toLowerCase();
  return projects.filter((project) => {
    if (query && !project.title.toLowerCase().includes(query)) return false;
    if (filters.priority !== "all" && project.priority !== filters.priority) return false;
    if (filters.status !== "all" && projectStats(project, tasks).state !== filters.status)
      return false;
    return true;
  });
}
