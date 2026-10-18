import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEADLINE_LABEL, type DeadlineState } from "@/lib/deadline";
import type { ProjectListFilters } from "@/lib/project-list-filters";
import type { Priority } from "@/types";

type Props = {
  filters: ProjectListFilters;
  onChange: (filters: ProjectListFilters, replace?: boolean) => void;
  onClear: () => void;
  resultCount: number;
};

const priorities: Priority[] = ["critical", "high", "medium", "low"];
const states: DeadlineState[] = [
  "on_track",
  "due_soon",
  "overdue",
  "completed_on_time",
  "completed_late",
  "no_deadline",
];

export function ProjectListFiltersBar({ filters, onChange, onClear, resultCount }: Props) {
  const [draft, setDraft] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setDraft(filters.search);
  }, [filters.search]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const hasFilters = Boolean(
    filters.search || filters.priority !== "all" || filters.status !== "all",
  );
  const updateSearch = (value: string, replace = false) =>
    onChange({ ...filters, search: value }, replace);

  return (
    <section
      aria-label="Filter projects"
      className="mb-5 rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            aria-label="Search projects"
            placeholder="Search project names"
            className="pl-9 pr-10"
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => updateSearch(value, true), 300);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                if (timer.current) clearTimeout(timer.current);
                updateSearch(draft, true);
              }
            }}
          />
          {draft ? (
            <button
              type="button"
              aria-label="Clear project search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setDraft("");
                updateSearch("", true);
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <Select
          value={filters.priority}
          onValueChange={(priority) =>
            onChange({ ...filters, priority: priority as Priority | "all" })
          }
        >
          <SelectTrigger aria-label="Filter by priority" className="sm:w-44">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {priorities.map((priority) => (
              <SelectItem key={priority} value={priority} className="capitalize">
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(status) =>
            onChange({ ...filters, status: status as DeadlineState | "all" })
          }
        >
          <SelectTrigger aria-label="Filter by deadline health" className="sm:w-48">
            <SelectValue placeholder="All deadline health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All deadline health</SelectItem>
            {states.map((state) => (
              <SelectItem key={state} value={state}>
                {DEADLINE_LABEL[state]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <p className="pt-3 px-1 text-sm text-muted-foreground" aria-live="polite">
        {resultCount} {resultCount === 1 ? "project" : "projects"}
      </p>
    </section>
  );
}
