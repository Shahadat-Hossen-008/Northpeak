import { AlertTriangle, Bell, CheckCircle2, Clock, FolderPlus, MessageSquare } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useMarkNotifications, useNotifications, useProjects } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/deadline";
import { cn, findProjectByIdOrSlug, projectSlug } from "@/lib/utils";
import type { NotificationPanelProps } from "./interface";

const ICONS: Record<string, typeof Bell> = {
  task_assigned: CheckCircle2,
  deadline_approaching: Clock,
  task_overdue: AlertTriangle,
  new_comment: MessageSquare,
  subtask_completed: CheckCircle2,
  project_created: FolderPlus,
};

const TONES: Record<string, string> = {
  task_assigned: "bg-primary-soft text-primary",
  deadline_approaching: "bg-warning-soft text-warning-foreground",
  task_overdue: "bg-danger-soft text-danger",
  new_comment: "bg-info-soft text-info",
  subtask_completed: "bg-success-soft text-success",
  project_created: "bg-secondary text-secondary-foreground",
};

export function NotificationPanel({ className }: NotificationPanelProps = {}) {
  const { role } = useAuth();
  const { data, isLoading, isError, error } = useNotifications();
  const projects = useProjects();
  const mark = useMarkNotifications();
  const items = data ?? [];
  const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);

  if (isLoading) return <LoadingState label="Loading notifications…" />;
  if (isError) return <ErrorState message={(error as Error)?.message} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="Assignments, deadline warnings and comments will show up here."
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm sm:text-base text-muted-foreground">
          {unreadIds.length} unread of {items.length}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadIds.length === 0 || mark.isPending}
          onClick={() => mark.mutate(unreadIds)}
        >
          Mark all as read
        </Button>
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const Icon = ICONS[item.kind] ?? Bell;
          const notifProject = item.project_id
            ? findProjectByIdOrSlug(projects.data ?? [], item.project_id)
            : null;
          const projectTarget = notifProject ? projectSlug(notifProject) : item.project_id;
          const targetHref = item.task_id
            ? role === "developer"
              ? `/developer/tasks/${item.task_id}`
              : `/manager/tasks/${item.task_id}`
            : projectTarget && role === "manager"
              ? `/manager/projects/${projectTarget}`
              : null;

          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3.5 rounded-xl border px-4 py-3.5 transition-colors",
                item.is_read
                  ? "border-border bg-card"
                  : "border-primary/30 bg-primary-soft/50 shadow-card",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-9.5 shrink-0 items-center justify-center rounded-lg",
                  TONES[item.kind] ?? "bg-secondary text-secondary-foreground",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {targetHref ? (
                    <Link
                      to={targetHref}
                      className="text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {item.title}
                    </p>
                  )}
                  {!item.is_read ? (
                    <span
                      className="inline-flex size-2 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  ) : null}
                </div>
                {item.body ? (
                  <p className="mt-1 text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                ) : null}
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {timeAgo(item.created_at)}
                </p>
              </div>
              {!item.is_read ? (
                <Button variant="ghost" size="sm" onClick={() => mark.mutate([item.id])}>
                  Read
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default NotificationPanel;
export type { NotificationPanelProps } from "./interface";
