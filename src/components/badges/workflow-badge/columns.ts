import type { WorkflowColumnDef } from "./interface";

export const WORKFLOW_COLUMNS: WorkflowColumnDef[] = [
  {
    key: "todo",
    title: "To do",
    dotColor: "bg-muted-foreground",
    badgeStyle: "bg-secondary text-secondary-foreground border-border",
    borderHover: "hover:border-foreground/30",
    columnBg: "bg-secondary/40",
  },
  {
    key: "in_progress",
    title: "In progress",
    dotColor: "bg-primary",
    badgeStyle: "bg-primary/10 text-primary border-primary/30",
    borderHover: "hover:border-primary/50",
    columnBg: "bg-primary/[0.03]",
  },
  {
    key: "in_review",
    title: "QA review",
    dotColor: "bg-amber-500",
    badgeStyle: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    borderHover: "hover:border-amber-500/50",
    columnBg: "bg-amber-500/[0.03]",
  },
  {
    key: "done",
    title: "Done",
    dotColor: "bg-success",
    badgeStyle: "bg-success/10 text-success border-success/30",
    borderHover: "hover:border-success/50",
    columnBg: "bg-success/[0.03]",
  },
];
