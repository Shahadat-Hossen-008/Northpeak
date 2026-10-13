import { Kanban, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskViewSwitcherProps } from "./interface";

export function TaskViewSwitcher({ view, onViewChange }: TaskViewSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Task layout view"
      className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={view === "board"}
        onClick={() => onViewChange("board")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
          view === "board"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Kanban className="size-3.5" />
        Board
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === "table"}
        onClick={() => onViewChange("table")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
          view === "table"
            ? "bg-card text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <TableIcon className="size-3.5" />
        Table
      </button>
    </div>
  );
}

export default TaskViewSwitcher;
export type { TaskViewSwitcherProps } from "./interface";
