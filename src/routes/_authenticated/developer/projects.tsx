import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/developer/projects")({
  head: () => meta("My projects", "Projects where you have assigned tasks."),
  component: DeveloperProjects,
});

function DeveloperProjects() {
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const ids = new Set(mine.map((t) => t.project_id));
  const list = (projects.data ?? []).filter((p) => ids.has(p.id));
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
        ) : list.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="You'll see projects here once a manager assigns you a task."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} tasks={mine} href="/developer/tasks" />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
