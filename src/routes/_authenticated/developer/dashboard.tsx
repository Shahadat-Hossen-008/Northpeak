import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { statusOf } from "@/components/badges";
import { DashboardMetricCard } from "@/components/DashboardMetricCard";
import { ProjectStatusDonutChart } from "@/components/ProjectStatusDonutChart";
import { TaskStatusDonutChart } from "@/components/TaskStatusDonutChart";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { TaskBoard } from "@/components/tasks";
import {
  useAllSubtasks,
  useCommentCounts,
  useProjects,
  useSetTaskCompletion,
  useTasks,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/developer/dashboard")({
  head: () => meta("My work", "Your assigned tasks on a board with live deadline status."),
  component: DeveloperDashboard,
});

function DeveloperDashboard() {
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const counts = useCommentCounts();
  const setDone = useSetTaskCompletion(profile?.id ?? null);

  const mine = (tasks.data ?? []).filter((t) => t.assigned_developer_id === profile?.id);
  const subs = subtasks.data ?? [];
  const allProjects = projects.data ?? [];
  const myProjects = allProjects.filter((p) => {
    const isTeam = p.team?.includes(profile?.id ?? "");
    const hasTasks = mine.some((t) => t.project_id === p.id);
    return isTeam || hasTasks;
  });

  const mineCompleted = mine.filter((t) => t.is_completed || t.status === "done").length;
  const inProgress = mine.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      (t.status === "in_progress" || t.status === "in_review"),
  ).length;
  const mineOverdue = mine.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      t.status !== "in_progress" &&
      t.status !== "in_review" &&
      statusOf(t) === "overdue",
  ).length;

  const loading = tasks.isLoading || projects.isLoading;
  const isError = tasks.isError || projects.isError;
  const errorMessage = ((tasks.error || projects.error) as Error)?.message;

  return (
    <AppShell section="developer">
      <PageHeader
        title={`Hi${profile ? `, ${profile.name.split(" ")[0]}` : ""}`}
        description="Your tasks, sorted by where they stand."
      />
      {loading ? (
        <LoadingState />
      ) : isError ? (
        <div className="mt-6">
          <ErrorState message={errorMessage} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Top Row: Four Circular Metric Cards */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardMetricCard
              title="Overall Tasks"
              value={mine.length > 0 ? Math.round((mineCompleted / mine.length) * 100) : 0}
              countSummary={`Total Tasks · ${mine.length}`}
              tone="primary"
              strokeColor="#6366f1"
            />
            <DashboardMetricCard
              title="Completed Tasks"
              value={mine.length > 0 ? Math.round((mineCompleted / mine.length) * 100) : 0}
              countSummary={`Completed · ${mineCompleted}`}
              tone="success"
              strokeColor="#10b981"
            />
            <DashboardMetricCard
              title="In-Progress Tasks"
              value={mine.length > 0 ? Math.round((inProgress / mine.length) * 100) : 0}
              countSummary={`In Progress · ${inProgress}`}
              tone="info"
              strokeColor="#3b82f6"
            />
            <DashboardMetricCard
              title="Overdue Tasks"
              value={mine.length > 0 ? Math.round((mineOverdue / mine.length) * 100) : 0}
              countSummary={`Overdue · ${mineOverdue}`}
              tone="danger"
              strokeColor="#ef4444"
            />
          </div>

          {/* Middle Row: Two Balanced Columns: Project Status (left) & Task Status (right) */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-stretch">
            <ProjectStatusDonutChart
              projects={myProjects}
              tasks={mine}
              isLoading={projects.isLoading}
              isError={projects.isError}
              errorMessage={projects.error instanceof Error ? projects.error.message : undefined}
            />
            <TaskStatusDonutChart
              tasks={mine}
              isLoading={tasks.isLoading}
              isError={tasks.isError}
              errorMessage={tasks.error instanceof Error ? tasks.error.message : undefined}
            />
          </div>

          {/* Remaining TaskBoard Section */}
          {mine.length === 0 ? (
            <EmptyState title="No tasks assigned" description="You're all caught up." />
          ) : (
            <TaskBoard
              tasks={mine}
              subtasks={subs}
              commentCounts={counts.data ?? {}}
              hrefFor={(t) => `/developer/tasks/${t.id}?from=/developer/dashboard`}
              onToggle={(task, completed) => setDone.mutate({ task, completed })}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
