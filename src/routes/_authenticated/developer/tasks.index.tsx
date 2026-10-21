import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { AppShell } from "@/builder/layout/app-shell";
import { ErrorState } from "@/components/feedback/error-state";
import { WorkspaceLoadingState } from "@/components/feedback/workspace-loading-state";
import { PageHeader } from "@/components/page-header";
import { meta } from "@/builder/layout/meta";
import { TaskBoard } from "@/sections/task-board";
import { TaskFilters } from "@/sections/task-filters";
import {
  getTaskFilterProjects,
  projectNameForTaskSearch,
  useFilteredTasks,
} from "@/lib/task-utils";
import { useAllSubtasks, useCommentCounts, useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { findProjectByIdOrSlug } from "@/lib/utils";
import { taskFiltersFromSearch, taskFiltersToSearch } from "@/lib/task-utils";

type TasksSearch = Record<string, unknown> & {
  project?: string | undefined;
  projectName?: string | undefined;
  q?: string | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  sort?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/developer/tasks/")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    ...search,
    ...taskFiltersToSearch(taskFiltersFromSearch(search, false), false),
    projectName:
      typeof search["project"] === "string" && typeof search["projectName"] === "string"
        ? search["projectName"]
        : undefined,
  }),
  head: () =>
    meta("My tasks", "Every task assigned to you with deadline status.", "/developer/tasks"),
  component: DeveloperTasks,
});

function DeveloperTasks() {
  const { profile } = useAuth();
  const search = Route.useSearch();
  const projectName = search["projectName"];
  const navigate = Route.useNavigate();
  const tasks = useTasks();
  const projects = useProjects();
  const subtasks = useAllSubtasks();
  const commentCounts = useCommentCounts();
  const isLoading =
    (tasks.isLoading && !tasks.data) ||
    (projects.isLoading && !projects.data) ||
    (subtasks.isLoading && !subtasks.data) ||
    (commentCounts.isLoading && !commentCounts.data);
  const loading = useMinimumLoading(isLoading);
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const eligibleProjects = getTaskFilterProjects(
    projects.data ?? [],
    tasks.data ?? [],
    profile?.id,
    "developer",
  );
  const filters = useMemo(() => taskFiltersFromSearch(search, false), [search]);
  const { filtered } = useFilteredTasks(mine, subtasks.data ?? [], filters);
  useEffect(() => {
    if (
      tasks.isLoading ||
      projects.isLoading ||
      !tasks.data ||
      !projects.data ||
      filters.project === "all"
    )
      return;
    const resolved = findProjectByIdOrSlug(eligibleProjects, filters.project);
    if (
      resolved &&
      (resolved.id !== filters.project ||
        projectName !==
          projectNameForTaskSearch({ ...filters, project: resolved.id }, eligibleProjects))
    ) {
      const normalized = { ...filters, project: resolved.id };
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          ...taskFiltersToSearch(
            normalized,
            false,
            projectNameForTaskSearch(normalized, eligibleProjects),
          ),
        }),
      });
    } else if (!resolved) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, project: undefined, projectName: undefined }),
      });
    }
  }, [
    tasks.isLoading,
    projects.isLoading,
    tasks.data,
    projects.data,
    filters.project,
    projectName,
    filters,
    eligibleProjects,
    navigate,
  ]);
  const setFilters = (next: typeof filters) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...taskFiltersToSearch(next, false, projectNameForTaskSearch(next, eligibleProjects)),
      }),
    });
  };
  const setSearch = (value: string) => {
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        ...taskFiltersToSearch(
          { ...filters, search: value },
          false,
          projectNameForTaskSearch(filters, eligibleProjects),
        ),
      }),
    });
  };
  const selectedProject = findProjectByIdOrSlug(eligibleProjects, filters.project);

  return (
    <AppShell
      section="developer"
      constrainToViewport
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={selectedProject ? `My tasks · ${selectedProject.title}` : "My tasks"}
        description={
          selectedProject
            ? `Tracking your assigned work and deadlines for ${selectedProject.title}.`
            : "Search, filter by project, manage workflow stages, and track deadlines for work assigned to you."
        }
      />
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <TaskFilters
              filters={filters}
              setFilters={setFilters}
              onSearchChange={setSearch}
              developers={[]}
              showDeveloper={false}
              projects={eligibleProjects}
              showProject={true}
            />
          </div>
        </div>
        {loading ? (
          <WorkspaceLoadingState />
        ) : tasks.isError ? (
          <ErrorState message={(tasks.error as Error).message} />
        ) : (
          <TaskBoard
            tasks={filtered}
            subtasks={subtasks.data ?? []}
            commentCounts={commentCounts.data ?? {}}
            hrefFor={(t) => `/developer/tasks/${t.id}`}
          />
        )}
      </div>
    </AppShell>
  );
}
