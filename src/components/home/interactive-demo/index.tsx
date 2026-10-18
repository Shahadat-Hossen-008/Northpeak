import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, Check, Layers, RotateCcw, ShieldAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { UserAvatar } from "@/components/avatar";
import { PriorityBadge, StatusBadge, WorkflowStatusBadge } from "@/components/badges";
import { ProgressBar } from "@/components/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  computeTaskMetrics,
  computeTaskProgress,
  INITIAL_TASKS,
  SPRINT_CHECKPOINTS,
  type PrototypeTask,
} from "../simulation";
import type { InteractiveDemoProps } from "./interface";

export function InteractiveDemo({
  variant = "full",
  initialPerspective = "manager",
  initialDay = 6,
  className,
}: InteractiveDemoProps) {
  const [activePerspective, setActivePerspective] = useState<"manager" | "developer">(
    initialPerspective,
  );
  const [sprintDay, setSprintDay] = useState<number>(initialDay);
  const [tasks, setTasks] = useState<PrototypeTask[]>(INITIAL_TASKS);

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updatedSubtasks = t.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st,
        );
        const allCompleted = updatedSubtasks.every((st) => st.completed);
        return {
          ...t,
          subtasks: updatedSubtasks,
          workflowState:
            allCompleted && t.workflowState !== "done" ? "in_progress" : t.workflowState,
        };
      }),
    );
  };

  const handleToggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextState: PrototypeTask["workflowState"] =
          t.workflowState === "done" ? "in_progress" : "done";
        const updatedTask = {
          ...t,
          workflowState: nextState,
        };
        if (nextState === "done") {
          return { ...updatedTask, completedAtDay: sprintDay };
        }
        delete updatedTask.completedAtDay;
        return updatedTask;
      }),
    );
  };

  const handleResetSimulation = () => {
    setSprintDay(initialDay);
    setActivePerspective(initialPerspective);
    setTasks(INITIAL_TASKS);
  };

  const computedTasks = useMemo(() => {
    return tasks.map((task) => computeTaskProgress(task, sprintDay));
  }, [tasks, sprintDay]);

  const metrics = useMemo(() => {
    return computeTaskMetrics(computedTasks);
  }, [computedTasks]);

  const displayedTasks = variant === "compact" ? computedTasks.slice(0, 3) : computedTasks;

  return (
    <div
      className={cn(
        "surface-card overflow-hidden rounded-2xl border-2 border-border shadow-raised",
        className,
      )}
    >
      {/* Workbench Titlebar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-secondary/40 px-5 py-3.5 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            <div className="size-3 rounded-full bg-danger/70" />
            <div className="size-3 rounded-full bg-warning/70" />
            <div className="size-3 rounded-full bg-success/70" />
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs sm:text-sm font-mono font-medium text-muted-foreground">
            cluster-alpha // sprint-34: Helios Ingestion Engine
          </span>
          <span className="hidden sm:inline-block rounded border border-border bg-card px-2 py-0.5 text-xs font-mono text-muted-foreground">
            Illustrative Simulation
          </span>
        </div>

        {/* Perspective Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-muted-foreground hidden sm:inline">
            Perspective:
          </span>
          <div
            role="radiogroup"
            aria-label="Workspace Perspective"
            className="flex rounded-lg border border-border bg-card p-1 shadow-xs"
          >
            <button
              type="button"
              role="radio"
              aria-checked={activePerspective === "manager"}
              onClick={() => setActivePerspective("manager")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activePerspective === "manager"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-4" />
              Engineering Manager
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={activePerspective === "developer"}
              onClick={() => setActivePerspective("developer")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activePerspective === "developer"
                  ? "bg-primary text-primary-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Layers className="size-4" />
              Senior Developer
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetSimulation}
            title="Reset simulation defaults"
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      {/* Interactive Sprint Timeline Scrubber */}
      <div className="border-b border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4.5 text-primary" />
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Sprint Timeline Simulator
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Advance time across the 14-day sprint to watch Northpeak recalculate deadline health
              across tasks in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm">
            <span className="text-muted-foreground">Simulated Day:</span>
            <span className="rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1 font-bold text-primary tabular">
              Day {sprintDay} of 14
            </span>
          </div>
        </div>

        {/* Range Slider */}
        <div className="space-y-3">
          <input
            type="range"
            min={1}
            max={14}
            step={1}
            value={sprintDay}
            onChange={(e) => setSprintDay(Number(e.target.value))}
            aria-label="Sprint Day Slider"
            className="w-full accent-primary cursor-pointer h-2 bg-secondary rounded-lg appearance-none"
          />

          {/* Checkpoint Pills */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {SPRINT_CHECKPOINTS.map((cp) => {
              const isSelected = sprintDay === cp.day;
              return (
                <button
                  key={cp.day}
                  type="button"
                  onClick={() => setSprintDay(cp.day)}
                  className={cn(
                    "flex flex-col items-center rounded-lg border p-2 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "border-primary bg-primary-soft text-primary font-bold shadow-xs"
                      : "border-border/80 bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <span className="text-xs sm:text-[13px] font-mono tabular">{cp.label}</span>
                  <span className="text-xs hidden sm:inline text-muted-foreground">{cp.phase}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvas Perspective Body */}
      <div className="p-5 sm:p-6 bg-background/50">
        {activePerspective === "manager" ? (
          /* ================= ENGINEERING MANAGER VIEW ================= */
          <div className="space-y-6">
            {/* Metric Overview Strip */}
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="surface-card p-4 sm:p-4.5">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Sprint Completion
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tabular">
                    {metrics.overallProgress}%
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground font-mono">
                    {metrics.completed}/{metrics.total} shipped
                  </span>
                </div>
                <ProgressBar value={metrics.overallProgress} className="mt-2.5 h-1.5" />
              </div>

              <div className="surface-card p-4 sm:p-4.5">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  On Track
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-bold text-info tabular">
                    {metrics.onTrack}
                  </span>
                  <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold text-info">
                    Safe buffer
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground">
                  Deadline &gt; 3 days away
                </p>
              </div>

              <div className="surface-card p-4 sm:p-4.5">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Due Soon
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-bold text-warning-foreground tabular">
                    {metrics.dueSoon}
                  </span>
                  <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
                    Urgent
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground">
                  ≤ 3 days left before cutoff
                </p>
              </div>

              <div className="surface-card p-4 sm:p-4.5">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Overdue
                </span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-bold text-danger tabular">
                    {metrics.overdue}
                  </span>
                  <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                    Breached
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-[13px] text-muted-foreground">
                  Target missed; triage required
                </p>
              </div>
            </div>

            {/* Overdue Alert Banner (conditional) */}
            {metrics.overdue > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-danger">
                <ShieldAlert className="size-5 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold">Automated Deadline Warning:</span> {metrics.overdue}{" "}
                  task(s) currently overdue on Day {sprintDay}. Immediate workload reallocation
                  recommended.
                </div>
              </div>
            )}

            {/* Manager Backlog Table */}
            <div className="surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Deliverables & Automatic Health Radar
                  </h4>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono font-medium">
                    {displayedTasks.length} {variant === "compact" ? "preview tasks" : "tasks"}
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                  Click checkbox to test completion
                </span>
              </div>

              <div className="divide-y divide-border">
                {displayedTasks.map((task) => {
                  const daysRemaining = task.dueDay - sprintDay;
                  return (
                    <div
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-card/60 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTaskStatus(task.id)}
                          title={
                            task.workflowState === "done" ? "Mark in progress" : "Mark completed"
                          }
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            task.workflowState === "done"
                              ? "border-success bg-success text-success-foreground"
                              : "border-input bg-card hover:border-primary",
                          )}
                        >
                          {task.workflowState === "done" && <Check className="size-3.5 stroke-3" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "text-sm sm:text-base font-semibold text-foreground truncate",
                                task.workflowState === "done" &&
                                  "line-through text-muted-foreground",
                              )}
                            >
                              {task.title}
                            </span>
                            <PriorityBadge priority={task.priority} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <UserAvatar name={task.assignee.name} size="sm" />
                              <span>{task.assignee.name}</span>
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              Subtasks: {task.completedSubtasks}/{task.subtasks.length}
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {task.workflowState === "done" ? (
                                <span className="text-success">Delivered</span>
                              ) : daysRemaining < 0 ? (
                                <span className="text-danger font-semibold">
                                  {Math.abs(daysRemaining)}d overdue
                                </span>
                              ) : daysRemaining === 0 ? (
                                <span className="text-warning-foreground font-semibold">
                                  Due today
                                </span>
                              ) : (
                                <span>{daysRemaining}d remaining</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <WorkflowStatusBadge status={task.workflowState} />
                        <StatusBadge state={task.deadlineState} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= SENIOR DEVELOPER VIEW ================= */
          <div className="space-y-6">
            {/* Developer Focus Header */}
            <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar name="Sarah Chen" size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base sm:text-lg font-bold text-foreground">Sarah Chen</h4>
                    <span className="rounded-md border border-primary/30 bg-primary-soft px-2 py-0.5 text-xs sm:text-[13px] font-semibold text-primary">
                      Assigned Developer
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Senior Backend Engineer • Sprint Focus: Payment Security & Webhook Engine
                  </p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground font-mono">
                <span>Live Task Status: </span>
                <strong className="text-foreground">
                  {computedTasks[0]?.deadlineState.replace("_", " ")}
                </strong>
              </div>
            </div>

            {/* Interactive Kanban Board Preview */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* To Do Column */}
              <div className="surface-card flex flex-col rounded-xl p-3.5 bg-secondary/30">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs sm:text-sm font-bold uppercase text-muted-foreground">
                    To Do
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono">1</span>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="surface-card p-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <PriorityBadge priority={computedTasks[2]?.priority ?? "medium"} />
                      <StatusBadge state={computedTasks[2]?.deadlineState ?? "on_track"} />
                    </div>
                    <h5 className="mt-2 text-xs sm:text-sm font-semibold text-foreground line-clamp-2">
                      {computedTasks[2]?.title}
                    </h5>
                    <div className="mt-3 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                      <span className="font-mono">Due Day 12</span>
                      <UserAvatar name={computedTasks[2]?.assignee.name ?? "John"} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* In Progress Column (Interactive Card Focus) */}
              <div className="surface-card flex flex-col rounded-xl p-3.5 bg-primary-soft/20 border-primary/40 ring-1 ring-primary/20">
                <div className="flex items-center justify-between pb-3 border-b border-primary/20">
                  <span className="text-xs sm:text-sm font-bold uppercase text-primary">
                    In Progress (Interactive)
                  </span>
                  <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs font-mono font-bold">
                    Active
                  </span>
                </div>

                {/* Sarah's Interactive Task Card */}
                <div className="mt-3 surface-card p-3.5 bg-card shadow-sm border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <PriorityBadge priority={computedTasks[0]?.priority ?? "critical"} />
                    <StatusBadge state={computedTasks[0]?.deadlineState ?? "due_soon"} />
                  </div>

                  <h5 className="mt-2 text-sm sm:text-base font-bold text-foreground">
                    {computedTasks[0]?.title}
                  </h5>

                  <div className="mt-2 text-xs sm:text-sm text-muted-foreground">
                    Target deadline: Sprint Day {computedTasks[0]?.dueDay}
                  </div>

                  {/* Interactive Subtask Checklist */}
                  <div className="mt-3 space-y-2 rounded-lg border border-border/80 bg-secondary/30 p-2.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-muted-foreground">
                      <span>Interactive Subtasks</span>
                      <span className="font-mono tabular">
                        {computedTasks[0]?.completedSubtasks}/{computedTasks[0]?.subtasks.length} (
                        {computedTasks[0]?.progressPercent}%)
                      </span>
                    </div>
                    <ProgressBar value={computedTasks[0]?.progressPercent ?? 0} className="h-1.5" />

                    <div className="space-y-1.5 pt-1">
                      {computedTasks[0]?.subtasks.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleToggleSubtask("task-1", st.id)}
                          className="flex w-full items-center gap-2 text-left text-xs sm:text-sm transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border transition-all",
                              st.completed
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-card",
                            )}
                          >
                            {st.completed && <Check className="size-3 stroke-3" />}
                          </span>
                          <span
                            className={cn(
                              "truncate",
                              st.completed
                                ? "line-through text-muted-foreground"
                                : "text-foreground font-medium",
                            )}
                          >
                            {st.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-border">
                    <Button
                      type="button"
                      size="sm"
                      variant={computedTasks[0]?.workflowState === "done" ? "outline" : "default"}
                      onClick={() => handleToggleTaskStatus("task-1")}
                      className="w-full text-xs sm:text-sm font-semibold"
                    >
                      {computedTasks[0]?.workflowState === "done"
                        ? "Mark In Progress"
                        : "Complete Deliverable"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Completed Column */}
              <div className="surface-card flex flex-col rounded-xl p-3.5 bg-secondary/30">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs sm:text-sm font-bold uppercase text-muted-foreground">
                    Done
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-mono">
                    {computedTasks.filter((t) => t.workflowState === "done").length}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {computedTasks
                    .filter((t) => t.workflowState === "done")
                    .map((task) => (
                      <div key={task.id} className="surface-card p-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <WorkflowStatusBadge status="done" />
                          <StatusBadge state={task.deadlineState} />
                        </div>
                        <h5 className="mt-2 text-xs sm:text-sm font-semibold line-clamp-2 line-through text-muted-foreground">
                          {task.title}
                        </h5>
                        <div className="mt-2 text-xs text-muted-foreground font-mono">
                          Shipped on Day {task.completedAtDay ?? task.dueDay}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Variant Footer Navigation Link */}
      {variant === "compact" && (
        <div className="border-t border-border bg-card px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <span className="text-muted-foreground">
            Want to test custom deadline filters, detailed calculations, and full board states?
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to="/features">
              Open full interactive canvas
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default InteractiveDemo;
export type { InteractiveDemoProps } from "./interface";
