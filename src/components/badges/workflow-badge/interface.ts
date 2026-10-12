import type { TaskWorkflowStatus } from "@/types";

export interface WorkflowColumnDef {
  key: TaskWorkflowStatus;
  title: string;
  dotColor: string;
  badgeStyle: string;
  borderHover: string;
  columnBg: string;
}

export interface WorkflowStatusBadgeProps {
  status: TaskWorkflowStatus;
  onSelect?: ((status: TaskWorkflowStatus) => void) | undefined;
  disabled?: boolean | undefined;
}
