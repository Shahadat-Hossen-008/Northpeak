import { cn } from "@/lib/utils";
import type { SectionCardProps } from "./interface";

export function SectionCard({ title, action, children, className }: SectionCardProps) {
  return (
    <section className={cn("surface-card flex flex-col", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6 sm:py-4.5">
        <h2 className="text-xs sm:text-sm font-bold tracking-wider text-foreground uppercase">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export default SectionCard;
export type { SectionCardProps } from "./interface";
