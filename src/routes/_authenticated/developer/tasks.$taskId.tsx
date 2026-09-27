import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TaskDetail } from "@/components/TaskDetail";
import { meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/developer/tasks/$taskId")({
  head: () => meta("Task details", "Your task, subtasks, comments and deadline."),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  return (
    <AppShell section="developer">
      <TaskDetail taskId={taskId} backHref="/developer/tasks" />
    </AppShell>
  );
}
