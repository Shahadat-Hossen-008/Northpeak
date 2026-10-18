import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeadlineBadge } from "@/components/badges/deadline-badge";
import { PriorityBadge } from "@/components/badges/priority-badge";
import { StatusBadge } from "@/components/badges/status-badge";
import { WorkflowStatusBadge } from "@/components/badges/workflow-badge";
import { borderForState, statusOf } from "@/components/badges/utils";
import { CommentSection } from "@/sections/comment-section";
import { SubtaskList } from "@/sections/subtask-list";
import { CircularProgress } from "@/components/progress/circular-progress";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { UserAvatar } from "@/components/avatar";
import { EditTaskDialog } from "@/components/dialogs/edit-task-dialog";
import { DeleteTaskDialog } from "@/components/dialogs/delete-task-dialog";
import {
  useActivity,
  useMembers,
  useSetTaskCompletion,
  useSubtasks,
  useTask,
  useUpdateTaskStatus,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, timeAgo } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import type { TaskDetailProps } from "./interface";

export function TaskDetail({ taskId, backHref }: TaskDetailProps) {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const { data: task, isLoading, isError, error } = useTask(taskId);
  const { data: subtasks } = useSubtasks(taskId);
  const { data: members } = useMembers();
  const { data: activity } = useActivity({ taskId, limit: 15 });
  const setCompletion = useSetTaskCompletion(profile?.id ?? null);
  const updateStatus = useUpdateTaskStatus();
  const developers = (members ?? []).filter((m) => m.role === "developer");

  if (isLoading) return <LoadingState label="Loading task…" />;
  if (isError) return <ErrorState message={(error as Error)?.message} />;
  if (!task) return <ErrorState message="This task no longer exists." />;

  const state = statusOf(task);
  const list = subtasks ?? [];
  const done = list.filter((s) => s.is_completed).length;
  const progress = task.is_completed
    ? 100
    : list.length === 0
      ? 0
      : Math.round((done / list.length) * 100);
  const isAssignee = task.assigned_developer_id === profile?.id;
  const canEdit = role === "manager" || isAssignee;

  const isBackToProject = backHref.includes("/projects");
  const isBackToDashboard = backHref.includes("/dashboard");
  const isBackToTeam = backHref.includes("/team");
  const backLabel = isBackToProject
    ? task.project?.title
      ? `Back to ${task.project.title}`
      : "Back to project"
    : isBackToDashboard
      ? "Back to dashboard"
      : isBackToTeam
        ? "Back to team"
        : "Back to tasks";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={backHref}>
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Button>

      <div className={cn("surface-card border p-6", borderForState(state))}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-medium text-muted-foreground">
              {task.project?.title}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {task.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
              {task.description || "No description provided."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex items-center gap-2">
              <WorkflowStatusBadge
                status={task.status || (task.is_completed ? "done" : "todo")}
                onSelect={
                  canEdit
                    ? (newStatus) => updateStatus.mutate({ id: task.id, status: newStatus })
                    : undefined
                }
                disabled={updateStatus.isPending}
              />
              <StatusBadge state={state} />
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <EditTaskDialog task={task} developers={developers} />
                {role === "manager" ? (
                  <DeleteTaskDialog
                    task={task}
                    onDeleted={() => {
                      void navigate({ to: backHref });
                    }}
                  />
                ) : null}
                <Button
                  variant={task.is_completed ? "outline" : "default"}
                  disabled={setCompletion.isPending}
                  onClick={() =>
                    setCompletion.mutate({
                      task: { id: task.id, title: task.title, project_id: task.project_id },
                      completed: !task.is_completed,
                    })
                  }
                >
                  {task.is_completed ? "Reopen task" : "Mark complete"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Created by</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium">
              {task.created_by ? (
                <>
                  <UserAvatar name={task.created_by.name} size="sm" />
                  {task.created_by.name}
                </>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Assigned by</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium">
              {task.assigned_by ? (
                <>
                  <UserAvatar name={task.assigned_by.name} size="sm" />
                  {task.assigned_by.name}
                </>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Assignee</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm sm:text-base font-medium">
              {task.assignee ? (
                <>
                  <UserAvatar name={task.assignee.name} size="sm" />
                  {task.assignee.name}
                </>
              ) : (
                "Unassigned"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Priority</dt>
            <dd className="mt-1">
              <PriorityBadge priority={task.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Deadline</dt>
            <dd className="tabular mt-1 text-sm sm:text-base font-medium">
              {formatDate(task.deadline)}
            </dd>
            <DeadlineBadge deadline={task.deadline} state={state} />
          </div>
          <div>
            <dt className="text-xs sm:text-sm text-muted-foreground">Progress</dt>
            <dd className="mt-2 flex items-center gap-2.5">
              <CircularProgress
                value={progress}
                size={38}
                strokeWidth={4}
                ariaLabel={`Task progress: ${progress}%`}
              />
              <div className="min-w-0">
                <span className="tabular text-xs sm:text-sm font-semibold text-foreground block">
                  {progress}%
                </span>
                <span className="text-xs sm:text-[13px] text-muted-foreground block">
                  {task.is_completed ? "Completed" : progress > 0 ? "In progress" : "Not started"}
                </span>
              </div>
            </dd>
          </div>
        </dl>
      </div>

      <Tabs defaultValue="subtasks">
        <TabsList>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="subtasks" className="surface-card mt-4 p-5">
          <SubtaskList
            taskId={task.id}
            projectId={task.project_id}
            actorId={profile?.id ?? null}
            canEdit={canEdit}
            canAssign={role === "manager"}
          />
        </TabsContent>
        <TabsContent value="comments" className="surface-card mt-4 p-5">
          <CommentSection
            taskId={task.id}
            projectId={task.project_id}
            actorId={profile?.id ?? null}
          />
        </TabsContent>
        <TabsContent value="activity" className="surface-card mt-4 p-5">
          {(activity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {(activity ?? []).map((item) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TaskDetail;
export type { TaskDetailProps } from "./interface";
