import { Link } from "@tanstack/react-router";

import { Brand } from "@/builder/layout/app-shell";
import { cn } from "@/lib/utils";
import type { HomeFooterProps } from "./interface";

export function HomeFooter({ className }: HomeFooterProps) {
  return (
    <footer className={cn("border-t border-border bg-card/40 py-10", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Brand />
            <p className="text-sm sm:text-base text-muted-foreground max-w-md">
              Deadline-aware project management purpose-built for software engineering teams.
              Automated status calculations without manual check-in meetings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm sm:text-base text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/roles" className="hover:text-foreground transition-colors">
              Roles & Workflows
            </Link>
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link to="/get-started" className="hover:text-foreground transition-colors">
              Get started
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Northpeak. All rights reserved.</span>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              Engine Online
            </span>
            <span>TypeScript 5</span>
            <span>React 19</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default HomeFooter;
export type { HomeFooterProps } from "./interface";
