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

export const Route = createFileRoute("/_authenticated/developer/tasks/$taskId")({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
  }),
  head: ({ params }) =>
    meta(
      "Task details",
      "Your task, subtasks, comments and deadline.",
      `/developer/tasks/${encodeURIComponent(params.taskId)}`,
    ),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  const { from } = Route.useSearch();
  const task = useTask(taskId);
  // Cached task details can render while stale data refreshes in the background.
  const loading = useMinimumLoading(task.isLoading && !task.data, taskId, [["task", taskId]]);
  return (
    <AppShell section="developer">
      <TaskDetail taskId={taskId} backHref={from || "/developer/tasks"} />
      {loading ? <WorkspaceLoadingState /> : null}
    </AppShell>
  );
}
