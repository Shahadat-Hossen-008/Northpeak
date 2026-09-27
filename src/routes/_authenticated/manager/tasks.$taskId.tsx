import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TaskDetail } from "@/components/TaskDetail";
import { meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/manager/tasks/$taskId")({
  head: () => meta("Task details", "Task progress, subtasks, comments and activity."),
  component: Page,
});

function Page() {
  const { taskId } = Route.useParams();
  return (
    <AppShell section="manager">
      <TaskDetail taskId={taskId} backHref="/manager/tasks" />
    </AppShell>
  );
}
