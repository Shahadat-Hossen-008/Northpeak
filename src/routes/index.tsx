import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { meta } from "@/builder/layout/meta";
import {
  DeadlineEngineShowcase,
  HomeFooter,
  HomeHero,
  HomeNav,
  InteractiveDemo,
  RoleComparison,
} from "@/components/home";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () =>
    meta(
      "Northpeak — Deadline-aware project management",
      "Northpeak gives software teams automatic deadline status on every task: on track, due soon, overdue, or completed late.",
    ),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between">
      <div>
        <HomeNav currentPath="/" />

        <main className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6 space-y-24">
          {/* Left-Aligned Hero */}
          <HomeHero />

          {/* Compact Interactive Canvas Preview */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                  Interactive Deadline Intelligence Canvas
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">
                  Preview how Northpeak calculates real-time task urgency across sprints.
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto text-xs sm:text-sm"
              >
                <Link to="/features">
                  View full interactive canvas
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>

            <InteractiveDemo variant="compact" initialPerspective="manager" initialDay={6} />
          </section>

          {/* 5 Deadline States Overview */}
          <DeadlineEngineShowcase variant="compact" />

          {/* Manager vs Developer Workflows Teaser */}
          <RoleComparison variant="teaser" />

          {/* Closing CTA */}
          <section className="surface-card overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-8 sm:p-12 text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                Ship software on time with total deadline clarity.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground">
                Get started today and experience automated sprint status updates with zero meetings.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link to="/register">
                    Create your workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-6">
                  <Link to="/login">Sign in</Link>
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

export default HomePage;
