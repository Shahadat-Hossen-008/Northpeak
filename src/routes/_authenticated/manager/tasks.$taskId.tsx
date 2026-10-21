import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/builder/layout/app-shell";
import { WorkspaceLoadingState } from "@/components/feedback/workspace-loading-state";
import { TaskDetail } from "@/sections/task-detail";
import { useTask } from "@/hooks/queries";
import { useMinimumLoading } from "@/hooks/use-minimum-loading";
import { meta } from "@/builder/layout/meta";

type TaskSearch = {
  from?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/manager/tasks/$taskId")({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
  }),
  head: ({ params }) =>
    meta(
      "Task details",
      "Task progress, subtasks, comments and activity.",
      `/manager/tasks/${encodeURIComponent(params.taskId)}`,
    ),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  const { from } = Route.useSearch();
  const task = useTask(taskId);
  const loading = useMinimumLoading(task.isLoading && !task.data, taskId);
  return (
    <AppShell section="manager">
      <TaskDetail taskId={taskId} backHref={from || "/manager/tasks"} />
      {loading ? <WorkspaceLoadingState /> : null}
    </AppShell>
  );
}
