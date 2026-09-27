import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeadlineBadge, PriorityBadge, StatusBadge, borderForState, statusOf } from "@/components/badges";
import { CommentSection } from "@/components/CommentSection";
import { SubtaskList } from "@/components/SubtaskList";
import { ErrorState, LoadingState, ProgressBar, UserAvatar } from "@/components/primitives";
import { useActivity, useSetTaskCompletion, useSubtasks, useTask } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, timeAgo } from "@/lib/deadline";
import { cn } from "@/lib/utils";

export function TaskDetail({ taskId, backHref }: { taskId: string; backHref: string }) {
  const { profile, role } = useAuth();
  const { data: task, isLoading, isError, error } = useTask(taskId);
  const { data: subtasks } = useSubtasks(taskId);
  const { data: activity } = useActivity({ taskId, limit: 15 });
  const setCompletion = useSetTaskCompletion(profile?.id ?? null);

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

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={backHref}>
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </Button>

      <div className={cn("surface-card border p-6", borderForState(state))}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{task.project?.title}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{task.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {task.description || "No description provided."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <StatusBadge state={state} />
            {canEdit ? (
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
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Developer</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
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
            <dt className="text-xs text-muted-foreground">Priority</dt>
            <dd className="mt-1">
              <PriorityBadge priority={task.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Deadline</dt>
            <dd className="tabular mt-1 text-sm font-medium">{formatDate(task.deadline)}</dd>
            <DeadlineBadge deadline={task.deadline} state={state} />
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Progress</dt>
            <dd className="mt-2">
              <ProgressBar value={progress} tone={progress === 100 ? "success" : "primary"} />
              <span className="tabular mt-1 block text-xs text-muted-foreground">{progress}%</span>
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
