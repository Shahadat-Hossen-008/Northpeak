import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { CreateTaskDialog } from "@/components/dialogs";
import { ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { TaskBoard, TaskFilters, useFilteredTasks } from "@/components/tasks";
import {
  useAllSubtasks,
  useCommentCounts,
  useMembers,
  useProjects,
  useTasks,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { findProjectByIdOrSlug } from "@/lib/utils";

type TasksSearch = {
  project?: string;
};

export const Route = createFileRoute("/_authenticated/manager/tasks/")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => meta("All tasks", "Search, filter and sort every task across your projects."),
  component: ManagerTasks,
});

function ManagerTasks() {
  const { profile } = useAuth();
  const { project } = Route.useSearch();
  const tasks = useTasks();
  const projects = useProjects();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const commentCounts = useCommentCounts();
  const developers = (members.data ?? []).filter((m) => m.role === "developer");
  const { filters, setFilters, filtered } = useFilteredTasks(
    tasks.data ?? [],
    subtasks.data ?? [],
    {
      project: project || "all",
    },
  );

  const selectedProject = findProjectByIdOrSlug(projects.data ?? [], filters.project);

  return (
    <AppShell section="manager">
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
            projects={projects.data ?? []}
            developers={developers}
            defaultProjectId={selectedProject?.id}
          />
        }
      />
      <div className="mt-6 space-y-4">
        <TaskFilters
          filters={filters}
          setFilters={setFilters}
          developers={developers}
          projects={projects.data ?? []}
          showProject={true}
        />
        {tasks.isLoading ? (
          <LoadingState />
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
