import { useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/builder/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { DashboardMetricCard } from "@/components/cards/metric-card";
import { SectionRenderer } from "@/sections/registry";
import { TaskBoard } from "@/sections/task-board";
import {
  useAllSubtasks,
  useCommentCounts,
  useProjects,
  useSetTaskCompletion,
  useTasks,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { selectDeveloperDashboardMetrics } from "@/lib/dashboard-selectors";
import type { DeveloperDashboardPageProps } from "./interface";

export function DeveloperDashboardPage(_props: DeveloperDashboardPageProps) {
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const counts = useCommentCounts();
  const setDone = useSetTaskCompletion(profile?.id ?? null);

  const {
    mine,
    myProjects,
    completedCount,
    inProgressCount,
    overdueCount,
    overallPercentage,
    completedPercentage,
    inProgressPercentage,
    overduePercentage,
  } = selectDeveloperDashboardMetrics({
    tasks: tasks.data,
    projects: projects.data,
    profileId: profile?.id,
  });

  const subs = subtasks.data ?? [];
  const loading = (tasks.isLoading && !tasks.data) || (projects.isLoading && !projects.data);
  const isError = (!tasks.data && tasks.isError) || (!projects.data && projects.isError);
  const errorMessage = ((tasks.error || projects.error) as Error)?.message;

  const isBackgroundRefetchError =
    (Boolean(tasks.data) && tasks.isError) || (Boolean(projects.data) && projects.isError);

  useEffect(() => {
    if (isBackgroundRefetchError) {
      const msg = errorMessage || "Failed to refresh dashboard data";
      toast.error(msg, { id: "developer-dashboard-refetch-error" });
    }
  }, [isBackgroundRefetchError, errorMessage]);

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
              value={overallPercentage}
              countSummary={`Total Tasks · ${mine.length}`}
              tone="primary"
              strokeColor="#6366f1"
            />
            <DashboardMetricCard
              title="Completed Tasks"
              value={completedPercentage}
              countSummary={`Completed · ${completedCount}`}
              tone="success"
              strokeColor="#10b981"
            />
            <DashboardMetricCard
              title="In-Progress Tasks"
              value={inProgressPercentage}
              countSummary={`In Progress · ${inProgressCount}`}
              tone="info"
              strokeColor="#3b82f6"
            />
            <DashboardMetricCard
              title="Overdue Tasks"
              value={overduePercentage}
              countSummary={`Overdue · ${overdueCount}`}
              tone="danger"
              strokeColor="#ef4444"
            />
          </div>

          {/* Middle Row: Two Balanced Columns: Project Status (left) & Task Status (right) */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-stretch">
            <SectionRenderer
              type="project-status-donut"
              props={{
                projects: myProjects,
                tasks: mine,
                isLoading: projects.isLoading || tasks.isLoading,
                isError: (!projects.data && projects.isError) || (!tasks.data && tasks.isError),
                errorMessage,
              }}
            />
            <SectionRenderer
              type="task-status-donut"
              props={{
                tasks: mine,
                isLoading: tasks.isLoading,
                isError: !tasks.data && tasks.isError,
                errorMessage: (tasks.error as Error)?.message,
              }}
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

export default DeveloperDashboardPage;
export type { DeveloperDashboardPageProps } from "./interface";
