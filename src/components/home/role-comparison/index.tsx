import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Layers, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleComparisonProps } from "./interface";

export function RoleComparison({ variant = "full", className }: RoleComparisonProps) {
  return (
    <section className={cn("space-y-12", className)}>
      <div className="text-left sm:text-center max-w-3xl sm:mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          Engineered for both sides of the sprint.
        </h2>
        <p className="mt-3.5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          A unified system providing macro clarity for engineering managers and zero-distraction
          focus for developers.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Manager Card */}
        <div className="surface-card p-6 sm:p-8 flex flex-col justify-between rounded-2xl border">
          <div>
            <div className="flex items-center gap-2 text-primary font-mono text-xs sm:text-sm font-bold uppercase tracking-wider">
              <Users className="size-4" />
              <span>Engineering Manager Hub</span>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground">
              Macro visibility without interrupting code.
            </h3>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Plan multi-week projects, balance developer capacity, and monitor overdue risk before
              deadlines slip. No need to ping engineers in Slack asking "what's the status?"
            </p>

            <ul className="mt-6 space-y-3.5 text-sm sm:text-base text-muted-foreground">
              {[
                "Live project completion progress & deadline status radar",
                "Developer workload distribution & active capacity indicators",
                "Granular task assignment with priority & strict start/due dates",
                "Real-time audit activity feed logging all task transitions",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {variant === "full" && (
              <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4 text-xs sm:text-sm space-y-2">
                <span className="font-bold text-foreground block">
                  Workflow Highlight: Workload Capacity
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  Managers assign tasks with explicit priority and deadline dates. The manager
                  dashboard computes workload distribution across engineers so no individual
                  developer exceeds sustainable capacity.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <Button asChild variant="outline" className="w-full">
              <Link to="/register">Create manager workspace</Link>
            </Button>
          </div>
        </div>

        {/* Developer Card */}
        <div className="surface-card p-6 sm:p-8 flex flex-col justify-between rounded-2xl border">
          <div>
            <div className="flex items-center gap-2 text-info font-mono text-xs sm:text-sm font-bold uppercase tracking-wider">
              <Layers className="size-4" />
              <span>Developer Execution Flow</span>
            </div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground">
              Tactical focus with automated status reporting.
            </h3>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Kanban boards, checklist subtasks, and instant discussion threads. As you tick off
              subtasks and ship pull requests, Northpeak handles your status reporting
              automatically.
            </p>

            <ul className="mt-6 space-y-3.5 text-sm sm:text-base text-muted-foreground">
              {[
                "Focused To do / In progress / Completed Kanban board view",
                "Checkable granular subtasks with instant progress percentage",
                "Real-time color-coded deadline countdown badges",
                "Collaborative discussion comments on every pull-request item",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-info" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {variant === "full" && (
              <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4 text-xs sm:text-sm space-y-2">
                <span className="font-bold text-foreground block">
                  Workflow Highlight: Granular Subtasks
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  Developers break complex stories into lightweight checklist items. As items are
                  checked off, progress percentage recalculates immediately, keeping the team
                  informed without context switching.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Sign in to developer queue</Link>
            </Button>
          </div>
        </div>
      </div>

      {variant === "teaser" && (
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link to="/roles">
              Compare full manager & developer workflows
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

export default RoleComparison;
export type { RoleComparisonProps } from "./interface";
