import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, CircleDot, ArrowRight } from "lucide-react";
import { useEffect } from "react";

import { Brand } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { homePathForRole, useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Northpeak — Deadline-aware project management" },
      {
        name: "description",
        content:
          "Northpeak gives software teams automatic deadline status on every task: on track, due soon, overdue, or completed late.",
      },
      { property: "og:title", content: "Northpeak — Deadline-aware project management" },
      {
        property: "og:description",
        content:
          "Managers plan and assign. Developers deliver. Every task shows its live deadline status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STATES = [
  {
    icon: CircleDot,
    label: "On track",
    tone: "bg-info-soft text-info",
    copy: "Deadline is comfortably ahead",
  },
  {
    icon: Clock,
    label: "Due soon",
    tone: "bg-warning-soft text-warning-foreground",
    copy: "Three days or less remaining",
  },
  {
    icon: AlertTriangle,
    label: "Overdue",
    tone: "bg-danger-soft text-danger",
    copy: "Deadline has already passed",
  },
  {
    icon: CheckCircle2,
    label: "Completed",
    tone: "bg-success-soft text-success",
    copy: "On time, or flagged as late",
  },
];

function Landing() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: role ? homePathForRole(role) : "/welcome", replace: true });
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6">
        <section className="max-w-3xl">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
            Built for software delivery teams
          </span>
          <h1 className="mt-6 text-4xl leading-tight font-extrabold text-foreground sm:text-5xl">
            Every task tells you exactly how its deadline is doing.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Managers create projects, break them into tasks and assign developers. Developers work
            through subtasks and comment as they go. Deadline status updates itself — no manual
            status meetings required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/register">
                Create your workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATES.map((state) => (
            <div key={state.label} className="surface-card p-5">
              <span
                className={`inline-flex size-10 items-center justify-center rounded-lg ${state.tone}`}
              >
                <state.icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-semibold text-foreground">{state.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{state.copy}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="surface-card p-6">
            <h2 className="text-lg font-bold text-foreground">For project managers</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                "Create projects with start dates, deadlines and priority",
                "Split work into tasks and assign them to developers",
                "Track progress, overdue work and developer workload",
                "Comment on tasks and follow every change in the activity feed",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-card p-6">
            <h2 className="text-lg font-bold text-foreground">For developers</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {[
                "See assigned tasks on a To do / In progress / Completed board",
                "Break a task into subtasks and tick them off",
                "Mark tasks complete and keep deadlines visible",
                "Collaborate with comments on every task",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground sm:px-6">
          Northpeak — project management for software teams.
        </div>
      </footer>
    </div>
  );
}
