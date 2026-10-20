import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/builder/layout/app-shell";
import { TaskDetail } from "@/sections/task-detail";
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
  return (
    <AppShell section="developer">
      <TaskDetail taskId={taskId} backHref={from || "/developer/tasks"} />
    </AppShell>
  );
}
