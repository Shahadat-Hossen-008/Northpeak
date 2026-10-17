import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEADLINE_STATES_INFO } from "../simulation";
import type { DeadlineEngineShowcaseProps } from "./interface";

export function DeadlineEngineShowcase({
  variant = "full",
  selectedState = null,
  onSelectState,
  className,
}: DeadlineEngineShowcaseProps) {
  return (
    <section className={cn("space-y-8", className)}>
      <div className="text-left sm:text-center max-w-3xl sm:mx-auto">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
          Automatic deadline calculations, explained.
        </h2>
        <p className="mt-3.5 text-base sm:text-lg text-muted-foreground leading-relaxed">
          Every status badge in Northpeak is calculated from timestamps and completion records.
          {variant === "full" ? " Click any state below to inspect its behavior." : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DEADLINE_STATES_INFO.map((item) => {
          const isSelected = selectedState === item.state;
          const isInteractive = variant === "full" && onSelectState;

          return (
            <div
              key={item.state}
              onClick={
                isInteractive ? () => onSelectState(isSelected ? null : item.state) : undefined
              }
              className={cn(
                "surface-card flex flex-col p-4 sm:p-5 text-left transition-all rounded-xl border",
                isInteractive && "cursor-pointer hover:border-primary/40 hover:bg-card/80",
                isSelected ? "ring-2 ring-primary border-primary bg-primary-soft/20 shadow-md" : "",
              )}
              role={isInteractive ? "button" : undefined}
              tabIndex={isInteractive ? 0 : undefined}
              onKeyDown={
                isInteractive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectState(isSelected ? null : item.state);
                      }
                    }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <StatusBadge state={item.state} />
              </div>
              <span className="mt-3.5 text-xs sm:text-sm font-bold font-mono text-muted-foreground">
                {item.rule}
              </span>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
              {isInteractive && (
                <span className="mt-auto pt-3 text-xs sm:text-[13px] font-semibold text-primary">
                  {isSelected ? "Filter active (tap to clear)" : "Click to highlight"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {variant === "compact" && (
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link to="/features">
              Explore mathematical logic & calculations
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

export default DeadlineEngineShowcase;
export type { DeadlineEngineShowcaseProps } from "./interface";
