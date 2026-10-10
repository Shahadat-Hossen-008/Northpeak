import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TaskDetail } from "@/components/TaskDetail";
import { meta } from "@/components/pages";

type TaskSearch = {
  from?: string;
};

export const Route = createFileRoute("/_authenticated/developer/tasks/$taskId")({
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  head: () => meta("Task details", "Your task, subtasks, comments and deadline."),
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
