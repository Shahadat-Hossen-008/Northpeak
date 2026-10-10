import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Folder,
  ListTodo,
  Mail,
  Timer,
} from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeadlineBadge, PriorityBadge, StatusBadge, type DeadlineState } from "@/components/badges";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ProgressBar,
  UserAvatar,
} from "@/components/primitives";
import { useMemberWorkload, type MemberWorkloadTask } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/deadline";
import { cn } from "@/lib/utils";

export interface MemberDetailSheetProps {
  memberId: string | null;
  projectId?: string;
  projectName?: string;
  fromHref?: string;
  onClose: () => void;
}

export function MemberDetailSheet({
  memberId,
  projectId,
  projectName,
  fromHref,
  onClose,
}: MemberDetailSheetProps) {
  const [filterMode, setFilterMode] = useState<"project" | "all">(projectId ? "project" : "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "overdue" | "completed">(
    "all",
  );

  const activeProjectId = filterMode === "project" ? projectId : undefined;
  const { data, isLoading, isError, error } = useMemberWorkload(memberId, activeProjectId);

  const open = Boolean(memberId);
  const member = data?.member;
  const stats = data?.stats;
  const allTasks = data?.tasks ?? [];

  const filteredTasks = allTasks.filter((task) => {
    if (statusFilter === "active") return !task.is_completed;
    if (statusFilter === "completed") return task.is_completed;
    if (statusFilter === "overdue") return task.status === "overdue";
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl overflow-y-auto p-6 sm:p-8"
      >
        <SheetHeader className="text-left pb-4 border-b border-border">
          {isLoading ? (
            <LoadingState label="Loading team member profile…" />
          ) : isError ? (
            <ErrorState message={(error as Error)?.message || "Failed to load member"} />
          ) : member ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="flex items-center gap-3">
                  <UserAvatar name={member.name} size="lg" />
                  <div>
                    <SheetTitle className="text-xl font-bold">{member.name}</SheetTitle>
                    <SheetDescription className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Mail className="size-3.5" />
                      <span>{member.email || "No email available"}</span>
                    </SheetDescription>
                  </div>
                </div>
                <Badge
                  variant={member.role === "manager" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {member.role || "Developer"}
                </Badge>
              </div>

              {member.created_at ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  Joined {formatDate(member.created_at)}
                </p>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        {stats ? (
          <div className="mt-5 space-y-6">
            {/* Project Filter Toggle (if in project context) */}
            {projectId && projectName ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 p-2 text-xs">
                <span className="font-medium text-muted-foreground">Filter context:</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={filterMode === "project" ? "default" : "ghost"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => setFilterMode("project")}
                  >
                    {projectName}
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === "all" ? "default" : "ghost"}
                    className="h-7 text-xs px-2.5"
                    onClick={() => setFilterMode("all")}
                  >
                    All Projects
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ListTodo className="size-3.5 text-primary" />
                  <span>Active</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular text-foreground">{stats.active}</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-success" />
                  <span>Done</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular text-success">{stats.completed}</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5 text-danger" />
                  <span>Overdue</span>
                </div>
                <p
                  className={cn(
                    "mt-1 text-2xl font-bold tabular",
                    stats.overdue > 0 ? "text-danger" : "text-muted-foreground",
                  )}
                >
                  {stats.overdue}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Timer className="size-3.5 text-warning-foreground" />
                  <span>Capacity</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular text-foreground">
                  {stats.workload_percentage}%
                </p>
              </div>
            </div>

            {/* Workload Progress Bar */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="font-semibold text-foreground">Workload capacity</span>
                <span className="tabular font-medium">
                  {stats.active} active {stats.active === 1 ? "task" : "tasks"} (
                  {stats.workload_percentage}%)
                </span>
              </div>
              <ProgressBar
                value={stats.workload_percentage}
                tone={
                  stats.overdue > 0
                    ? "danger"
                    : stats.workload_percentage > 80
                      ? "warning"
                      : "primary"
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.workload_percentage >= 80
                  ? "High capacity load. Consider balancing or reassigning upcoming work."
                  : stats.workload_percentage >= 40
                    ? "Healthy workload capacity."
                    : "Low workload. Ready for new task assignments."}
              </p>
            </div>

            {/* Assigned Tasks Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Assigned tasks ({allTasks.length})
                </h3>

                <Tabs
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2.5">
                      All ({allTasks.length})
                    </TabsTrigger>
                    <TabsTrigger value="active" className="text-xs px-2.5">
                      Active ({stats.active})
                    </TabsTrigger>
                    <TabsTrigger value="overdue" className="text-xs px-2.5">
                      Overdue ({stats.overdue})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs px-2.5">
                      Done ({stats.completed})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {filteredTasks.length === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  title="No tasks found"
                  description="No tasks match the selected status filter."
                />
              ) : (
                <ul className="space-y-2.5">
                  {filteredTasks.map((task) => (
                    <TaskItemRow
                      key={task.id}
                      task={task}
                      projectId={projectId}
                      fromHref={fromHref}
                      onNavigate={onClose}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TaskItemRow({
  task,
  projectId,
  fromHref,
  onNavigate,
}: {
  task: MemberWorkloadTask;
  projectId?: string | null | undefined;
  fromHref?: string | undefined;
  onNavigate: () => void;
}) {
  const { role } = useAuth();
  const state = task.status as DeadlineState;
  const hasSubtasks = task.subtasks_count > 0;
  const subPercent = hasSubtasks
    ? Math.round((task.subtasks_completed_count / task.subtasks_count) * 100)
    : 0;
  const taskRoute = role === "developer" ? "/developer/tasks/$taskId" : "/manager/tasks/$taskId";

  return (
    <li>
      <Link
        to={taskRoute}
        params={{ taskId: task.id }}
        search={{
          from: fromHref ?? (projectId ? `/manager/projects/${projectId}` : undefined),
        }}
        onClick={onNavigate}
        title={`Open task: ${task.title}`}
        className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-card hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 max-w-full text-sm font-semibold text-foreground">
              <span className="relative inline-block pb-0.5 truncate text-foreground group-hover:text-primary transition-colors after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all after:duration-300 after:ease-out group-hover:after:w-full">
                {task.title}
              </span>
              <ArrowUpRight className="size-4 text-primary shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>

            {task.project?.title ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Folder className="size-3.5 shrink-0" />
                <span className="truncate">{task.project.title}</span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityBadge priority={task.priority} />
            <StatusBadge state={state} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
          <div>
            {task.deadline ? (
              <span className="flex items-center gap-1">
                <span>Due:</span>
                <span className="tabular font-medium text-foreground">
                  {formatDate(task.deadline)}
                </span>
                <DeadlineBadge deadline={task.deadline} state={state} />
              </span>
            ) : (
              <span>No deadline</span>
            )}
          </div>

          {hasSubtasks ? (
            <div className="flex items-center gap-2">
              <span className="tabular">
                {task.subtasks_completed_count}/{task.subtasks_count} subtasks
              </span>
              <div className="w-16">
                <ProgressBar value={subPercent} tone={task.is_completed ? "success" : "primary"} />
              </div>
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
