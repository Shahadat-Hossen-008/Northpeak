import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { TaskFilters, TaskTable, useFilteredTasks } from "@/components/tasks";
import { useAllSubtasks, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/developer/tasks/")({
  head: () => meta("My tasks", "Every task assigned to you with deadline status."),
  component: DeveloperTasks,
});

function DeveloperTasks() {
  const { profile } = useAuth();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const { filters, setFilters, filtered } = useFilteredTasks(mine, subtasks.data ?? []);
  return (
    <AppShell section="developer">
      <PageHeader
        title="My tasks"
        description="Search, filter and sort the work assigned to you."
      />
      <div className="mt-6 space-y-4">
        <TaskFilters
          filters={filters}
          setFilters={setFilters}
          developers={[]}
          showDeveloper={false}
        />
        {tasks.isLoading ? (
          <LoadingState />
        ) : tasks.isError ? (
          <ErrorState message={(tasks.error as Error).message} />
        ) : (
          <TaskTable
            tasks={filtered}
            subtasks={subtasks.data ?? []}
            hrefFor={(t) => `/developer/tasks/${t.id}`}
          />
        )}
      </div>
    </AppShell>
  );
}
