import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell } from "@/builder/layout/app-shell";
import { ProjectCard } from "@/sections/project-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/page-header";
import { meta } from "@/builder/layout/meta";
import { useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_PROJECT_LIST_FILTERS,
  filterProjects,
  projectListFiltersFromSearch,
  projectListFiltersToSearch,
} from "@/lib/project-list-filters";
import { ProjectListFiltersBar } from "@/sections/project-list-filters";
import { projectSlug } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/developer/projects")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      ...search,
      ...projectListFiltersToSearch(projectListFiltersFromSearch(search)),
    }) as {
      q?: string | undefined;
      priority?: string | undefined;
      status?: string | undefined;
    },
  head: () => meta("My projects", "Projects where you have assigned tasks."),
  component: DeveloperProjects,
});

function DeveloperProjects() {
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const filters = useMemo(() => projectListFiltersFromSearch(search), [search]);
  // The projects endpoint is already role-scoped (team membership or assigned work).
  const authorizedProjects = projects.data ?? [];
  const list = filterProjects(authorizedProjects, mine, filters);
  const changeFilters = (next: typeof filters, replace = false) => {
    void navigate({
      replace,
      search: (previous) => ({ ...previous, ...projectListFiltersToSearch(next) }),
    });
  };
  const clearFilters = () => changeFilters(DEFAULT_PROJECT_LIST_FILTERS);
  return (
    <AppShell section="developer">
      <PageHeader
        title="My projects"
        description="Projects you're contributing to. Progress reflects your tasks."
      />
      <div className="mt-6">
        {projects.isLoading || tasks.isLoading ? (
          <LoadingState />
        ) : projects.isError ? (
          <ErrorState message={(projects.error as Error).message} />
        ) : authorizedProjects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="You'll see projects here once a manager assigns you a task."
          />
        ) : (
          <>
            <ProjectListFiltersBar
              filters={filters}
              onChange={changeFilters}
              onClear={clearFilters}
              resultCount={list.length}
            />
            {list.length === 0 ? (
              <EmptyState
                title="No matching projects"
                description="Try a different search or clear your filters."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    tasks={mine}
                    href={`/developer/tasks?project=${encodeURIComponent(p.id)}&projectName=${encodeURIComponent(projectSlug(p))}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
