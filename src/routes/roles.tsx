import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Sparkles, Users } from "lucide-react";

import { meta } from "@/builder/layout/meta";
import { HomeFooter, HomeNav, RoleComparison } from "@/components/home";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/roles")({
  head: () =>
    meta(
      "Roles & Workflows",
      "Compare Northpeak workspaces for Engineering Managers and Developers. Macro visibility paired with tactical execution.",
    ),
  component: RolesPage,
});

function RolesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between">
      <div>
        <HomeNav currentPath="/roles" />

        <main className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6">
          {/* Page Header */}
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <Sparkles className="size-3.5 text-primary" />
              <span>Workspace Perspectives</span>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Tailored for how engineering teams work.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Software delivery requires two distinct views: high-level capacity and risk visibility
              for team leads, and high-focus tactical execution for developers. Northpeak unites
              both in real-time.
            </p>
          </div>

          {/* Full Role Comparison */}
          <section className="mb-20">
            <RoleComparison variant="full" />
          </section>

          {/* Day in the Life Walkthrough Grid */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
              A sprint with Northpeak: Side-by-side
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface-card p-6 rounded-2xl border space-y-4">
                <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase">
                  <Users className="size-4" />
                  <span>The Manager's Morning</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">Zero-meeting status check</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Open the Manager Dashboard. Review the <strong>Project Status Donut</strong> and{" "}
                  <strong>Overdue Work Radar</strong>. Instantly identify if any task slipped into{" "}
                  <code className="text-warning-foreground font-mono bg-warning-soft px-1.5 py-0.5 rounded text-xs">
                    due_soon
                  </code>{" "}
                  or{" "}
                  <code className="text-danger font-mono bg-danger-soft px-1.5 py-0.5 rounded text-xs">
                    overdue
                  </code>
                  . Reallocate capacity without sending a single Slack message.
                </p>
              </div>

              <div className="surface-card p-6 rounded-2xl border space-y-4">
                <div className="flex items-center gap-2 text-info font-mono text-xs font-bold uppercase">
                  <Layers className="size-4" />
                  <span>The Developer's Flow</span>
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Clear priorities and zero noise
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Open the Developer Dashboard. See your assigned tasks ordered by deadline urgency
                  on your Kanban board. Check off subtasks as commits land. When a task is finished,
                  Northpeak stamps it as{" "}
                  <code className="text-success font-mono bg-success-soft px-1.5 py-0.5 rounded text-xs">
                    completed_on_time
                  </code>{" "}
                  automatically.
                </p>
              </div>
            </div>
          </section>

          {/* Closing CTA */}
          <section className="surface-card overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-8 sm:p-12 text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Ready to transform your sprint workflow?
              </h2>
              <p className="mt-4 text-base text-muted-foreground">
                Join engineering teams shipping with automated deadline clarity.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link to="/register">
                    Create your workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-6">
                  <Link to="/features">Test-drive live features</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <HomeFooter />
    </div>
  );
}

export default RolesPage;
