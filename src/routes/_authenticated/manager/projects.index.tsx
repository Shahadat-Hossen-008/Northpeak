import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { CreateProjectDialog } from "@/components/dialogs";
import { ProjectCard } from "@/components/ProjectCard";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { projectSlug } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/projects/")({
  head: () => meta("Projects", "All projects you manage with progress and deadline status."),
  component: ManagerProjects,
});

function ManagerProjects() {
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const create = <CreateProjectDialog actorId={profile?.id ?? null} />;
  return (
    <AppShell section="manager">
      <PageHeader
        title="Projects"
        description="Every project, its progress and deadline health."
        action={create}
      />
      <div className="mt-6">
        {projects.isLoading || tasks.isLoading ? (
          <LoadingState />
        ) : projects.isError ? (
          <ErrorState message={(projects.error as Error).message} />
        ) : (projects.data ?? []).length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create your first project to get started."
            action={create}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.data!.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                tasks={tasks.data ?? []}
                href={`/manager/projects/${projectSlug(p)}`}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
