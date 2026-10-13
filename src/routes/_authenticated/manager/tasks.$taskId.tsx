import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/builder/layout/app-shell";
import { TaskDetail } from "@/sections/task-detail";
import { meta } from "@/builder/layout/meta";

type TaskSearch = {
  from?: string | undefined;
};

export const Route = createFileRoute("/_authenticated/manager/tasks/$taskId")({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
  }),
  head: () => meta("Task details", "Task progress, subtasks, comments and activity."),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  const { from } = Route.useSearch();
  return (
    <AppShell section="manager">
      <TaskDetail taskId={taskId} backHref={from || "/manager/tasks"} />
    </AppShell>
  );
}
