import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import {
  TaskBoard,
  TaskFilters,
  TaskTable,
  TaskViewSwitcher,
  useFilteredTasks,
} from "@/components/tasks";
import { useAllSubtasks, useCommentCounts, useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { findProjectByIdOrSlug } from "@/lib/utils";

type TasksSearch = {
  project?: string;
};

export const Route = createFileRoute("/_authenticated/developer/tasks/")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => meta("My tasks", "Every task assigned to you with deadline status."),
  component: DeveloperTasks,
});

function DeveloperTasks() {
  const { profile } = useAuth();
  const { project } = Route.useSearch();
  const tasks = useTasks();
  const projects = useProjects();
  const subtasks = useAllSubtasks();
  const commentCounts = useCommentCounts();
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const { filters, setFilters, filtered } = useFilteredTasks(mine, subtasks.data ?? [], {
    project: project || "all",
  });
  const [view, setView] = useState<"board" | "table">("board");

  const selectedProject = findProjectByIdOrSlug(projects.data ?? [], filters.project);

  return (
    <AppShell section="developer">
      <PageHeader
        title={selectedProject ? `My tasks · ${selectedProject.title}` : "My tasks"}
        description={
          selectedProject
            ? `Tracking your assigned work and deadlines for ${selectedProject.title}.`
            : "Search, filter by project, manage workflow stages, and track deadlines for work assigned to you."
        }
      />
      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <TaskFilters
              filters={filters}
              setFilters={setFilters}
              developers={[]}
              showDeveloper={false}
              projects={projects.data ?? []}
              showProject={true}
            />
          </div>
          <div className="shrink-0 self-end sm:self-auto">
            <TaskViewSwitcher view={view} onViewChange={setView} />
          </div>
        </div>
        {tasks.isLoading ? (
          <LoadingState />
        ) : tasks.isError ? (
          <ErrorState message={(tasks.error as Error).message} />
        ) : view === "table" ? (
          <TaskTable
            tasks={filtered}
            subtasks={subtasks.data ?? []}
            hrefFor={(t) => `/developer/tasks/${t.id}`}
          />
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
