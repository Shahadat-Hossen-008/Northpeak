import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HomeHeroProps } from "./interface";

export function HomeHero({ className }: HomeHeroProps) {
  return (
    <section className={cn("max-w-4xl text-left pt-6 pb-4", className)}>
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground shadow-xs">
        <Sparkles className="size-4 text-primary" />
        <span>Deterministic Deadline Engine for Engineering Teams</span>
      </div>

      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl sm:leading-[1.1]">
        Every engineering task tells you how its deadline is doing.
      </h1>

      <p className="mt-5 text-lg text-muted-foreground sm:text-xl lg:text-2xl leading-relaxed max-w-3xl">
        Managers define deliverables and capacity. Developers ship code and check subtasks.
        Northpeak calculates real-time deadline health automatically — with zero manual status
        meetings.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button asChild size="lg" className="h-12 px-7 text-base sm:text-lg">
          <Link to="/register">
            Create your workspace
            <ArrowRight className="size-4.5" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base sm:text-lg">
          <Link to="/features">Explore live features</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-muted-foreground font-mono">
        <span>&bull; Role-specific workspaces (Manager & Developer)</span>
        <span>&bull; Interactive simulation below</span>
      </div>
    </section>
  );
}

export default HomeHero;
export type { HomeHeroProps } from "./interface";
