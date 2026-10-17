import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/builder/layout/app-shell";
import { CreateTaskDialog } from "@/components/dialogs/create-task-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/page-header";
import { meta } from "@/builder/layout/meta";
import { TaskBoard } from "@/sections/task-board";
import { TaskFilters } from "@/sections/task-filters";
import { useFilteredTasks } from "@/lib/task-utils";
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
  project?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/manager/tasks/")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    project: typeof search["project"] === "string" ? search["project"] : undefined,
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
            projects={projects.data ?? []}
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
              developers={developers}
              projects={projects.data ?? []}
              showProject={true}
            />
          </div>
        </div>
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
