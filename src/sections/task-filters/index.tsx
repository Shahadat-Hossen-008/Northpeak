import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findProjectByIdOrSlug } from "@/lib/utils";
import type { TaskFiltersProps } from "./interface";

export function TaskFilters({
  filters,
  setFilters,
  onSearchChange,
  developers,
  projects = [],
  showDeveloper = true,
  showProject = false,
}: TaskFiltersProps) {
  const [draftSearch, setDraftSearch] = useState(filters.search);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setDraftSearch(filters.search);
  }, [filters]);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  const changeFilter = (key: keyof typeof filters, value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setFilters({ ...filters, search: draftSearch, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-56">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draftSearch}
          onChange={(e) => {
            const value = e.target.value;
            setDraftSearch(value);
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => onSearchChange(value), 350);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (debounceTimer.current) clearTimeout(debounceTimer.current);
              onSearchChange(draftSearch);
            }
          }}
          placeholder="Search tasks by title"
          className="pl-9"
          aria-label="Search tasks"
        />
      </div>
      {showProject && projects && projects.length > 0 ? (
        <Select
          value={findProjectByIdOrSlug(projects, filters.project)?.id ?? filters.project}
          onValueChange={(value) => changeFilter("project", value)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((proj) => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select value={filters.status} onValueChange={(value) => changeFilter("status", value)}>
        <SelectTrigger className="sm:w-40" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="on_track">On track</SelectItem>
          <SelectItem value="due_soon">Due soon</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      {showDeveloper ? (
        <Select
          value={filters.developer}
          onValueChange={(value) => changeFilter("developer", value)}
        >
          <SelectTrigger className="sm:w-44" aria-label="Filter by developer">
            <SelectValue placeholder="Developer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All developers</SelectItem>
            {developers.map((dev) => (
              <SelectItem key={dev.id} value={dev.id}>
                {dev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select value={filters.priority} onValueChange={(value) => changeFilter("priority", value)}>
        <SelectTrigger className="sm:w-36" aria-label="Filter by priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.sort} onValueChange={(value) => changeFilter("sort", value)}>
        <SelectTrigger className="sm:w-40" aria-label="Sort tasks">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="deadline">Sort: deadline</SelectItem>
          <SelectItem value="priority">Sort: priority</SelectItem>
          <SelectItem value="progress">Sort: progress</SelectItem>
          <SelectItem value="title">Sort: title</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export default TaskFilters;
export type { TaskFiltersProps } from "./interface";
