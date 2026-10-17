import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useState } from "react";

import { meta } from "@/builder/layout/meta";
import { DeadlineEngineShowcase, HomeFooter, HomeNav, InteractiveDemo } from "@/components/home";
import { Button } from "@/components/ui/button";
import type { DeadlineState } from "@/types/frontend";

export const Route = createFileRoute("/features")({
  head: () =>
    meta(
      "Features & Deadline Engine",
      "Test-drive Northpeak's interactive deadline intelligence engine, sprint timeline simulator, and automatic health states.",
    ),
  component: FeaturesPage,
});

function FeaturesPage() {
  const [inspectedStateFilter, setInspectedStateFilter] = useState<DeadlineState | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary flex flex-col justify-between">
      <div>
        <HomeNav currentPath="/features" />

        <main className="mx-auto max-w-6xl px-4 pt-12 pb-24 sm:px-6">
          {/* Page Header */}
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs sm:text-sm font-medium text-muted-foreground shadow-xs">
              <Sparkles className="size-3.5 text-primary" />
              <span>Interactive Feature Workbench</span>
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
              Deadline Intelligence in action.
            </h1>
            <p className="mt-4 text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Experience how Northpeak eliminates manual sprint status meetings. Scrub timeline
              checkpoints, switch between manager and developer views, and explore the mathematical
              deadline health states.
            </p>
          </div>

          {/* Full Interactive Canvas */}
          <section className="mb-20">
            <InteractiveDemo variant="full" initialPerspective="manager" initialDay={6} />
          </section>

          {/* Complete 5 Deadline States Breakdown */}
          <section className="mb-20">
            <DeadlineEngineShowcase
              variant="full"
              selectedState={inspectedStateFilter}
              onSelectState={setInspectedStateFilter}
            />
          </section>

          {/* Closing CTA */}
          <section className="surface-card overflow-hidden rounded-3xl border border-border bg-linear-to-b from-card to-secondary/30 p-8 sm:p-12 text-center">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                Ready to ship on time with your team?
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground">
                Set up a workspace for your software engineering team in less than 60 seconds.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="h-11 px-6">
                  <Link to="/get-started">
                    Create your workspace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-11 px-6">
                  <Link to="/roles">Explore team roles</Link>
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

export default FeaturesPage;
