import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { MemberDetailSheet } from "@/components/MemberDetailSheet";
import { PriorityBadge, statusOf } from "@/components/badges";
import { CreateTaskDialog, EditProjectDialog, DeleteProjectDialog } from "@/components/dialogs";
import { ConfirmDelete, meta } from "@/components/pages";
import { EmptyState, LoadingState, SectionCard, UserAvatar } from "@/components/primitives";
import { ProjectOverviewCard, ProjectTasksList } from "@/components/ProjectDeliverables";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActivity,
  useAllSubtasks,
  useCommentCounts,
  useDeleteTask,
  useMembers,
  useProjects,
  useTasks,
  type Task,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/deadline";
import { findProjectByIdOrSlug, projectSlug } from "@/lib/utils";

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

  const project = findProjectByIdOrSlug(projects.data ?? [], projectId);
  const actualProjectId = project?.id ?? projectId;

  const activity = useActivity({ projectId: actualProjectId, limit: 30 });
  const commentCounts = useCommentCounts();
  const del = useDeleteTask();
  const [pending, setPending] = useState<Task | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const projectTasks = (tasks.data ?? []).filter((t) => t.project_id === actualProjectId);
  const developers = (members.data ?? []).filter((m) => m.role === "developer");

  useEffect(() => {
    if (project?.title) {
      document.title = `${project.title} — Northpeak`;
    }
  }, [project?.title]);

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

  return (
    <AppShell section="manager">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/manager/projects"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Projects
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground truncate max-w-xs sm:max-w-md">
          {project.title}
        </span>
      </div>
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

      <Tabs defaultValue="tasks" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tasks">Tasks ({projectTasks.length})</TabsTrigger>
          <TabsTrigger value="team">Team ({team.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-6">
          <ProjectOverviewCard
            project={project}
            tasks={projectTasks}
            subtasks={subtasks.data ?? []}
          />

          {projectTasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description="Break this project down into tasks and assign them to team members."
              action={addTask}
            />
          ) : (
            <ProjectTasksList
              tasks={projectTasks}
              subtasks={subtasks.data ?? []}
              commentCounts={commentCounts.data ?? {}}
              hrefFor={(t) =>
                `/manager/tasks/${t.id}?from=/manager/projects/${projectSlug(project)}`
              }
              renderAddTask={
                <CreateTaskDialog
                  actorId={profile?.id ?? null}
                  projects={projects.data ?? []}
                  developers={developers}
                  defaultProjectId={project.id}
                  trigger={
                    <Button size="sm" className="h-9">
                      <Plus className="size-3.5" /> Add task
                    </Button>
                  }
                />
              }
            />
          )}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {team.length === 0 ? (
            <EmptyState
              title="No one assigned yet"
              description="Assign deliverables to add developers to this project."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((d) => {
                const mine = projectTasks.filter((t) => t.assigned_developer_id === d.id);
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMemberId(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedMemberId(d.id);
                      }
                    }}
                    className="surface-card group cursor-pointer flex items-center justify-between gap-3 p-4 transition-all hover:border-primary/50 hover:shadow-card hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar name={d.name} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate group-hover:text-primary transition-colors">
                          {d.name}
                        </p>
                        <p className="tabular text-xs text-muted-foreground truncate">
                          {mine.filter((t) => t.is_completed).length}/{mine.length} done ·{" "}
                          {mine.filter((t) => statusOf(t) === "overdue").length} overdue
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-70 group-hover:opacity-100 shrink-0 transition-opacity">
                      Tasks
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
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
      <MemberDetailSheet
        memberId={selectedMemberId}
        projectId={project.id}
        projectName={project.title}
        fromHref={`/manager/projects/${projectSlug(project)}`}
        onClose={() => setSelectedMemberId(null)}
      />
    </AppShell>
  );
}
