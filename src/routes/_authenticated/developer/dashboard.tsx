import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ListTodo, Timer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { statusOf } from "@/components/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "@/components/primitives";
import { meta } from "@/components/pages";
import { TaskBoard } from "@/components/tasks";
import { useAllSubtasks, useCommentCounts, useSetTaskCompletion, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/developer/dashboard")({
  head: () => meta("My work", "Your assigned tasks on a board with live deadline status."),
  component: DeveloperDashboard,
});

function DeveloperDashboard() {
  const { profile } = useAuth();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const counts = useCommentCounts();
  const setDone = useSetTaskCompletion(profile?.id ?? null);
  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const subs = subtasks.data ?? [];
  const inProgress = mine.filter(
    (t) => !t.is_completed && subs.some((s) => s.task_id === t.id && s.is_completed),
  ).length;

  return (
    <AppShell section="developer">
      <PageHeader
        title={`Hi${profile ? `, ${profile.name.split(" ")[0]}` : ""}`}
        description="Your tasks, sorted by where they stand."
      />
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.isError ? (
        <div className="mt-6">
          <ErrorState message={(tasks.error as Error).message} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Assigned" value={mine.length} icon={ListTodo} tone="primary" />
            <StatCard label="In progress" value={inProgress} icon={Timer} tone="neutral" />
            <StatCard
              label="Completed"
              value={mine.filter((t) => t.is_completed).length}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Overdue"
              value={mine.filter((t) => statusOf(t) === "overdue").length}
              icon={AlertTriangle}
              tone="danger"
            />
          </div>
          {mine.length === 0 ? (
            <EmptyState title="No tasks assigned" description="You're all caught up." />
          ) : (
            <TaskBoard
              tasks={mine}
              subtasks={subs}
              commentCounts={counts.data ?? {}}
              hrefFor={(t) => `/developer/tasks/${t.id}`}
              onToggle={(task, completed) => setDone.mutate({ task, completed })}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
