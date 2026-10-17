import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WORKFLOW_COLUMNS } from "./columns";
import type { WorkflowStatusBadgeProps } from "./interface";

export function WorkflowStatusBadge({ status, onSelect, disabled }: WorkflowStatusBadgeProps) {
  const current = WORKFLOW_COLUMNS.find((c) => c.key === status) ?? WORKFLOW_COLUMNS[0]!;

  if (!onSelect) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs sm:text-sm font-medium",
          current.badgeStyle,
        )}
      >
        <span className={cn("size-2 rounded-full", current.dotColor)} />
        {current.title}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "group/status inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
          current.badgeStyle,
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-85",
        )}
      >
        <span className={cn("size-2 rounded-full shrink-0", current.dotColor)} />
        <span>{current.title}</span>
        <ChevronDown className="size-3.5 opacity-60 transition-transform group-hover/status:opacity-100" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40 p-1">
        {WORKFLOW_COLUMNS.map((col) => {
          const isSelected = col.key === status;
          return (
            <DropdownMenuItem
              key={col.key}
              onClick={() => onSelect(col.key)}
              className={cn(
                "flex items-center justify-between text-xs sm:text-sm font-medium cursor-pointer py-2 px-2.5",
                isSelected ? "bg-accent text-accent-foreground font-semibold" : "",
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", col.dotColor)} />
                {col.title}
              </span>
              {isSelected ? <Check className="size-3.5 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkflowStatusBadge;
export type { WorkflowStatusBadgeProps, WorkflowColumnDef } from "./interface";
