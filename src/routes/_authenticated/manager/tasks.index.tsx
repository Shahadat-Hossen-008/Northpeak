import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/builder/layout/app-shell";
import { CreateTaskDialog } from "@/components/dialogs/create-task-dialog";
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
import {
  useAllSubtasks,
  useCommentCounts,
  useMembers,
  useProjects,
  useTasks,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { findProjectByIdOrSlug } from "@/lib/utils";
import { taskFiltersFromSearch, taskFiltersToSearch } from "@/lib/task-utils";

type TasksSearch = Record<string, unknown> & {
  project?: string | undefined;
  projectName?: string | undefined;
  q?: string | undefined;
  status?: string | undefined;
  developer?: string | undefined;
  priority?: string | undefined;
  sort?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/manager/tasks/")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    ...search,
    ...taskFiltersToSearch(taskFiltersFromSearch(search, true), true),
    projectName:
      typeof search["project"] === "string" && typeof search["projectName"] === "string"
        ? search["projectName"]
        : undefined,
  }),
  head: () =>
    meta("All tasks", "Search, filter and sort every task across your projects.", "/manager/tasks"),
  component: ManagerTasks,
});

function ManagerTasks() {
  const { profile } = useAuth();
  const search = Route.useSearch();
  const projectName = search["projectName"];
  const navigate = Route.useNavigate();
  const tasks = useTasks();
  const projects = useProjects();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const commentCounts = useCommentCounts();
  const isLoading =
    (tasks.isLoading && !tasks.data) ||
    (projects.isLoading && !projects.data) ||
    (subtasks.isLoading && !subtasks.data) ||
    (members.isLoading && !members.data) ||
    (commentCounts.isLoading && !commentCounts.data);
  // Cached task-board inputs can render while stale data refreshes in the background.
  const loading = useMinimumLoading(isLoading, "manager-tasks", [
    ["tasks"],
    ["projects"],
    ["subtasks", "all"],
    ["members"],
    ["comment-counts"],
  ]);
  const developers = (members.data ?? []).filter((m) => m.role === "developer");
  const filters = useMemo(() => taskFiltersFromSearch(search, true), [search]);
  const managerProjects = getTaskFilterProjects(
    projects.data ?? [],
    tasks.data ?? [],
    profile?.id,
    "manager",
  );
  useEffect(() => {
    if (projects.isLoading || !projects.data || filters.project === "all") return;
    const resolved = findProjectByIdOrSlug(managerProjects, filters.project);
    if (
      resolved &&
      (resolved.id !== filters.project ||
        projectName !==
          projectNameForTaskSearch({ ...filters, project: resolved.id }, managerProjects))
    ) {
      const normalized = { ...filters, project: resolved.id };
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          ...taskFiltersToSearch(
            normalized,
            true,
            projectNameForTaskSearch(normalized, managerProjects),
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
    projects.isLoading,
    projects.data,
    filters,
    filters.project,
    projectName,
    managerProjects,
    navigate,
  ]);
  const { filtered } = useFilteredTasks(tasks.data ?? [], subtasks.data ?? [], filters);
  const setFilters = (next: typeof filters) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...taskFiltersToSearch(next, true, projectNameForTaskSearch(next, managerProjects)),
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
          true,
          projectNameForTaskSearch(filters, managerProjects),
        ),
      }),
    });
  };

  const selectedProject = findProjectByIdOrSlug(managerProjects, filters.project);

  return (
    <AppShell section="manager" constrainToViewport contentClassName="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={selectedProject ? `Tasks · ${selectedProject.title}` : "Tasks"}
        description={
          selectedProject
            ? `Tracking workflow stages and deadlines for ${selectedProject.title}.`
            : "Every task across your projects with live deadline status and Notion-style column management."
        }
        action={
          <CreateTaskDialog
            actorId={profile?.id ?? null}
            projects={managerProjects}
            developers={developers}
            defaultProjectId={selectedProject?.id}
          />
        }
      />
      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <TaskFilters
              filters={filters}
              setFilters={setFilters}
              onSearchChange={setSearch}
              developers={developers}
              projects={managerProjects}
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
            hrefFor={(t) => `/manager/tasks/${t.id}`}
          />
        )}
      </div>
    </AppShell>
  );
}
