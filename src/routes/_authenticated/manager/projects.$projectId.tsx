import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PriorityBadge, StatusBadge, statusOf } from "@/components/badges";
import { CreateTaskDialog, EditProjectDialog, DeleteProjectDialog } from "@/components/dialogs";
import { ConfirmDelete, meta } from "@/components/pages";
import { projectStats } from "@/components/ProjectCard";
import {
  EmptyState,
  LoadingState,
  ProgressBar,
  SectionCard,
  StatCard,
  UserAvatar,
} from "@/components/primitives";
import { TaskFilters, TaskTable, useFilteredTasks } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActivity,
  useAllSubtasks,
  useDeleteTask,
  useMembers,
  useProjects,
  useTasks,
  type Task,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { deadlineText, formatDate, timeAgo } from "@/lib/deadline";

export const Route = createFileRoute("/_authenticated/manager/projects/$projectId")({
  head: () => meta("Project details", "Project overview, progress, tasks, team and activity."),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const projects = useProjects();
  const tasks = useTasks();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const activity = useActivity({ projectId, limit: 30 });
  const del = useDeleteTask();
  const [pending, setPending] = useState<Task | null>(null);

  const project = (projects.data ?? []).find((p) => p.id === projectId);
  const projectTasks = (tasks.data ?? []).filter((t) => t.project_id === projectId);
  const developers = (members.data ?? []).filter((m) => m.role === "developer");
  const { filters, setFilters, filtered } = useFilteredTasks(projectTasks, subtasks.data ?? []);

  if (projects.isLoading || tasks.isLoading)
    return (
      <AppShell section="manager">
        <LoadingState />
      </AppShell>
    );
  if (!project)
    return (
      <AppShell section="manager">
        <EmptyState
          title="Project not found"
          description="It may have been removed."
          action={
            <Button asChild variant="outline">
              <Link to="/manager/projects">Back to projects</Link>
            </Button>
          }
        />
      </AppShell>
    );

  const stats = projectStats(project, tasks.data ?? []);
  const teamIds = new Set(projectTasks.map((t) => t.assigned_developer_id).filter(Boolean));
  const team = developers.filter((d) => teamIds.has(d.id));
  const addTask = (
    <CreateTaskDialog
      actorId={profile?.id ?? null}
      projects={projects.data ?? []}
      developers={developers}
      defaultProjectId={project.id}
      trigger={
        <Button>
          <Plus className="size-4" /> Add task
        </Button>
      }
    />
  );
  const count = (s: string) => projectTasks.filter((t) => statusOf(t) === s).length;

  return (
    <AppShell section="manager">
      <Link
        to="/manager/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <PriorityBadge priority={project.priority} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditProjectDialog project={project} />
          <DeleteProjectDialog
            project={project}
            onDeleted={() => void navigate({ to: "/manager/projects", replace: true })}
          />
          {addTask}
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({projectTasks.length})</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Progress"
            icon={TrendingUp}
            value={`${stats.progress}%`}
            tone="primary"
          />
          <StatCard
            label="Tasks done"
            icon={CheckCircle2}
            value={`${stats.completed} / ${stats.total}`}
            tone="success"
          />
          <StatCard label="Overdue" icon={AlertTriangle} value={count("overdue")} tone="danger" />
          <StatCard
            label="Deadline"
            icon={CalendarClock}
            value={formatDate(project.deadline)}
            hint={project.deadline ? deadlineText(project.deadline) : ""}
            tone="neutral"
          />
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <SectionCard title="Completion">
            <ProgressBar value={stats.progress} />
            <p className="tabular mt-2 text-sm text-muted-foreground">
              {stats.progress}% complete · {stats.completed}/{stats.total} tasks
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(
                ["on_track", "due_soon", "overdue", "completed_on_time", "completed_late"] as const
              ).map((s) => (
                <span key={s} className="flex items-center gap-2 text-sm">
                  <StatusBadge state={s} />{" "}
                  <span className="tabular font-semibold">{count(s)}</span>
                </span>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <TaskFilters filters={filters} setFilters={setFilters} developers={developers} />
          {projectTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="Break this project into tasks and assign them."
              action={addTask}
            />
          ) : (
            <TaskTable
              tasks={filtered}
              subtasks={subtasks.data ?? []}
              hrefFor={(t) => `/manager/tasks/${t.id}`}
              onDelete={setPending}
            />
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {team.length === 0 ? (
            <EmptyState
              title="No one assigned yet"
              description="Assign tasks to add developers to this project."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((d) => {
                const mine = projectTasks.filter((t) => t.assigned_developer_id === d.id);
                return (
                  <div key={d.id} className="surface-card flex items-center gap-3 p-4">
                    <UserAvatar name={d.name} />
                    <div>
                      <p className="font-semibold">{d.name}</p>
                      <p className="tabular text-xs text-muted-foreground">
                        {mine.filter((t) => t.is_completed).length}/{mine.length} done ·{" "}
                        {mine.filter((t) => statusOf(t) === "overdue").length} overdue
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <SectionCard title="Activity">
            {(activity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.data!.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <UserAvatar name={a.actor?.name ?? "System"} size="sm" />
                    <p className="text-sm">
                      <span className="font-semibold">{a.actor?.name ?? "System"}</span> {a.message}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {timeAgo(a.created_at)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
      <ConfirmDelete
        task={pending}
        onClose={() => setPending(null)}
        onConfirm={(t) => del.mutate(t.id)}
      />
    </AppShell>
  );
}
