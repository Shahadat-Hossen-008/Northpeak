import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FolderKanban,
  Activity as ActivityIcon,
  Rocket,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { MemberDetailSheet } from "@/components/MemberDetailSheet";
import { CreateProjectDialog } from "@/components/dialogs";
import { ProjectCard } from "@/components/ProjectCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatCard,
  UserAvatar,
} from "@/components/primitives";
import { DeadlineBadge, StatusBadge, statusOf } from "@/components/badges";
import { useActivity, useAllSubtasks, useMembers, useProjects, useTasks } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, timeAgo } from "@/lib/deadline";
import { projectSlug } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({
    meta: [
      { title: "Manager dashboard — Northpeak" },
      {
        name: "description",
        content: "Project progress, overdue work, developer workload and upcoming deadlines.",
      },
      { property: "og:title", content: "Manager dashboard — Northpeak" },
      {
        property: "og:description",
        content: "Project progress, overdue work, developer workload and upcoming deadlines.",
      },
    ],
  }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const activity = useActivity({ limit: 8 });

  const loading = projects.isLoading || tasks.isLoading;
  const failed = projects.isError || tasks.isError;

  const allTasks = tasks.data ?? [];
  const allProjects = projects.data ?? [];
  const developers = (members.data ?? []).filter((m) => m.role === "developer");

  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const overdueTasks = allTasks.filter((t) => statusOf(t) === "overdue");
  const activeProjects = allProjects.filter((project) => {
    const projectTasks = allTasks.filter((t) => t.project_id === project.id);
    return projectTasks.length === 0 || projectTasks.some((t) => !t.is_completed);
  });
  const upcoming = allTasks
    .filter((t) => !t.is_completed && t.deadline && new Date(t.deadline) >= new Date())
    .slice(0, 6);

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
          <ErrorState message={(projects.error as Error)?.message} />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total projects"
              value={allProjects.length}
              icon={FolderKanban}
              tone="primary"
            />
            <StatCard
              label="Active projects"
              value={activeProjects.length}
              icon={Rocket}
              tone="neutral"
            />
            <StatCard
              label="Completed tasks"
              value={completedTasks}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Overdue tasks"
              value={overdueTasks.length}
              icon={AlertTriangle}
              tone="danger"
              hint={overdueTasks.length > 0 ? "Needs attention today" : "All clear"}
            />
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Projects overview
              </h2>
              <Link
                to="/manager/projects"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            {allProjects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to get started."
                action={<CreateProjectDialog actorId={profile?.id ?? null} />}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {allProjects.slice(0, 6).map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    tasks={allTasks}
                    href={`/manager/projects/${projectSlug(project)}`}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Overdue tasks">
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing is overdue. Nice work.</p>
              ) : (
                <ul className="space-y-3">
                  {overdueTasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/manager/tasks/$taskId"
                          params={{ taskId: task.id }}
                          search={{ from: "/manager/dashboard" }}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
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
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/manager/tasks/$taskId"
                          params={{ taskId: task.id }}
                          search={{ from: "/manager/dashboard" }}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {task.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">No developers yet.</p>
              ) : (
                <ul className="space-y-2">
                  {developers.map((dev) => {
                    const mine = allTasks.filter((t) => t.assigned_developer_id === dev.id);
                    const active = mine.filter((t) => !t.is_completed).length;
                    const overdue = mine.filter((t) => statusOf(t) === "overdue").length;
                    const load = Math.min(100, active * 20);
                    return (
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
                            <span className="flex items-center gap-2 text-sm font-medium group-hover:text-primary transition-colors">
                              <UserAvatar name={dev.name} size="sm" />
                              {dev.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="tabular text-xs text-muted-foreground">
                                {active} active · {overdue} overdue
                              </span>
                              <ArrowUpRight className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          </div>
                          <ProgressBar
                            className="mt-2"
                            value={load}
                            tone={overdue > 0 ? "danger" : load > 60 ? "warning" : "primary"}
                          />
                        </div>
                      </li>
                    );
                  })}
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
                        <p className="text-sm">
                          <span className="font-semibold">{item.actor?.name ?? "System"}</span>{" "}
                          {item.message}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</p>
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
