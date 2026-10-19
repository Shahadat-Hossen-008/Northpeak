import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, MessageSquare, Sparkles, Users } from "lucide-react";

import { meta } from "@/builder/layout/meta";
import { HomeFooter, HomeNav, RoleComparison } from "@/components/home";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/roles")({
  head: () =>
    meta(
      "Roles & Workflows",
      "Compare Northpeak workspaces for Engineering Managers and Developers. Macro visibility paired with tactical execution.",
      "/roles",
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
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs sm:text-sm font-medium text-muted-foreground shadow-xs">
              <Sparkles className="size-3.5 text-primary" />
              <span>Workspace Perspectives</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
              Two views, one delivery system.
            </h1>
            <p className="mt-4 text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Northpeak keeps planning and execution connected without forcing every teammate into
              the same workflow. Compare the manager’s control room with the developer’s daily
              queue.
            </p>
          </div>

          {/* Full Role Comparison */}
          <section className="mb-20">
            <RoleComparison variant="full" />
          </section>

          {/* Distinct operating moments */}
          <section className="mb-20">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-6">
              What each view makes easier
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface-card p-6 rounded-2xl border space-y-4">
                <div className="flex items-center gap-2 text-primary font-mono text-xs sm:text-sm font-bold uppercase">
                  <ClipboardList className="size-4" />
                  <span>Manager planning desk</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  Turn a delivery plan into visible ownership
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Start with the project shape, add the right engineers, then make priorities and
                  deadlines explicit. The manager view turns a crowded sprint into a short list of
                  decisions: what is blocked, who has room, and where risk is accumulating.
                </p>
              </div>

              <div className="surface-card p-6 rounded-2xl border space-y-4">
                <div className="flex items-center gap-2 text-info font-mono text-xs sm:text-sm font-bold uppercase">
                  <MessageSquare className="size-4" />
                  <span>Developer delivery desk</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  Keep progress understandable as the work changes
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  Open assigned work with its requirements and deadline in view. Move a task when
                  its state changes, break the next step into subtasks, and leave context in the
                  discussion so teammates never have to reconstruct progress from a silent board.
                </p>
              </div>
            </div>
          </section>

          {/* Closing CTA */}
          <section className="surface-card overflow-hidden rounded-3xl border border-border bg-linear-to-b from-card to-secondary/30 p-8 sm:p-12 text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                Ready to transform your sprint workflow?
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground">
                Join engineering teams shipping with automated deadline clarity.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link to="/get-started">
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
