import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity as ActivityIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/builder/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { CreateProjectDialog } from "@/components/dialogs/create-project-dialog";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { DashboardMetricCard } from "@/components/cards/metric-card";
import { SectionCard } from "@/components/cards/section-card";
import { UserAvatar } from "@/components/avatar";
import { ProgressBar } from "@/components/progress/progress-bar";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { StatusBadge } from "@/components/badges/status-badge";
import { statusOf } from "@/components/badges/utils";
import { MemberDetailSheet } from "@/sections/member-detail-sheet";
import { SectionRenderer } from "@/sections/registry";
import { useActivity, useAllSubtasks, useMembers, useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { selectManagerDashboardMetrics } from "@/lib/dashboard-selectors";
import { formatDate, timeAgo } from "@/lib/deadline";
import type { ManagerDashboardPageProps } from "./interface";

export function ManagerDashboardPage(_props: ManagerDashboardPageProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const activity = useActivity({ limit: 8 });

  const loading = (projects.isLoading && !projects.data) || (tasks.isLoading && !tasks.data);
  const failed = (!projects.data && projects.isError) || (!tasks.data && tasks.isError);
  const errorMessage = ((projects.error || tasks.error) as Error)?.message;

  const isBackgroundRefetchError =
    (Boolean(projects.data) && projects.isError) || (Boolean(tasks.data) && tasks.isError);

  useEffect(() => {
    if (isBackgroundRefetchError) {
      const msg = errorMessage || "Failed to refresh dashboard data";
      toast.error(msg, { id: "manager-dashboard-refetch-error" });
    }
  }, [isBackgroundRefetchError, errorMessage]);

  const {
    allTasks,
    allProjects,
    developers,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    allOverdueTasks,
    upcomingTasks,
    overallPercentage,
    completedPercentage,
    inProgressPercentage,
    overduePercentage,
    developerWorkloads,
  } = selectManagerDashboardMetrics({
    tasks: tasks.data,
    projects: projects.data,
    members: members.data,
  });

  return (
    <AppShell section="manager">
      <PageHeader
        title={`Welcome back${profile ? `, ${profile.name.split(" ")[0]}` : ""}`}
        description="Everything your team is delivering, with live deadline status."
        action={<CreateProjectDialog actorId={profile?.id ?? null} />}
      />

      {loading ? (
        <LoadingState />
      ) : failed ? (
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
              countSummary={`Total Tasks · ${allTasks.length}`}
              tone="primary"
              strokeColor="#6366f1"
            />
            <DashboardMetricCard
              title="Completed Tasks"
              value={completedPercentage}
              countSummary={`Completed · ${completedTasks}`}
              tone="success"
              strokeColor="#10b981"
            />
            <DashboardMetricCard
              title="In-Progress Tasks"
              value={inProgressPercentage}
              countSummary={`In Progress · ${inProgressTasks}`}
              tone="info"
              strokeColor="#3b82f6"
            />
            <DashboardMetricCard
              title="Overdue Tasks"
              value={overduePercentage}
              countSummary={`Overdue · ${overdueTasks.length}`}
              tone="danger"
              strokeColor="#ef4444"
            />
          </div>

          {/* Middle Row: Two Balanced Columns: Project Status (left) & Task Status (right) */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-stretch">
            <SectionRenderer
              type="project-status-donut"
              props={{
                projects: allProjects,
                tasks: allTasks,
                isLoading: projects.isLoading || tasks.isLoading,
                isError: (!projects.data && projects.isError) || (!tasks.data && tasks.isError),
                errorMessage,
              }}
            />
            <SectionRenderer
              type="task-status-donut"
              props={{
                tasks: allTasks,
                isLoading: tasks.isLoading,
                isError: !tasks.data && tasks.isError,
                errorMessage: (tasks.error as Error)?.message,
              }}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Overdue tasks">
              {overdueTasks.length === 0 ? (
                <p className="text-sm sm:text-base text-muted-foreground">
                  Nothing is overdue. Nice work.
                </p>
              ) : (
                <ul className="space-y-3">
                  {overdueTasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/manager/tasks/$taskId"
                          params={{ taskId: task.id }}
                          search={{ from: "/manager/dashboard" }}
                          className="text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {task.project?.title} · {task.assignee?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <DeadlineBadge deadline={task.deadline} state="overdue" />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Upcoming deadlines">
              {upcomingTasks.length === 0 ? (
                <p className="text-sm sm:text-base text-muted-foreground">No upcoming deadlines.</p>
              ) : (
                <ul className="space-y-3">
                  {upcomingTasks.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/manager/tasks/$taskId"
                          params={{ taskId: task.id }}
                          search={{ from: "/manager/dashboard" }}
                          className="text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {task.project?.title} · {formatDate(task.deadline)}
                        </p>
                      </div>
                      <StatusBadge state={statusOf(task)} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Developer workload">
              {developers.length === 0 ? (
                <p className="text-sm sm:text-base text-muted-foreground">No developers yet.</p>
              ) : (
                <ul className="space-y-2">
                  {developerWorkloads.map(
                    ({ member: dev, activeCount, overdueCount, loadPercentage }) => (
                      <li key={dev.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedMemberId(dev.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedMemberId(dev.id);
                            }
                          }}
                          className="group cursor-pointer rounded-lg p-2.5 -mx-2 transition-all hover:bg-secondary/60 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm sm:text-base font-medium group-hover:text-primary transition-colors">
                              <UserAvatar name={dev.name} size="sm" />
                              {dev.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="tabular text-xs sm:text-sm text-muted-foreground">
                                {activeCount} active · {overdueCount} overdue
                              </span>
                              <ArrowUpRight className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          </div>
                          <ProgressBar
                            className="mt-2"
                            value={loadPercentage}
                            tone={
                              overdueCount > 0
                                ? "danger"
                                : loadPercentage > 60
                                  ? "warning"
                                  : "primary"
                            }
                          />
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recent activity">
              {(activity.data ?? []).length === 0 ? (
                <EmptyState
                  icon={ActivityIcon}
                  title="No activity yet"
                  description="Task and project updates will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {(activity.data ?? []).map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <UserAvatar name={item.actor?.name ?? "System"} size="sm" />
                      <div>
                        <p className="text-sm sm:text-base">
                          <span className="font-semibold">{item.actor?.name ?? "System"}</span>{" "}
                          {item.message}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {timeAgo(item.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {subtasks.isError ? <ErrorState message="Subtask progress failed to load." /> : null}
        </div>
      )}

      <MemberDetailSheet
        memberId={selectedMemberId}
        fromHref="/manager/dashboard"
        onClose={() => setSelectedMemberId(null)}
      />
    </AppShell>
  );
}

export default ManagerDashboardPage;
export type { ManagerDashboardPageProps } from "./interface";
