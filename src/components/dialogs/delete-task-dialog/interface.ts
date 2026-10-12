import type { ReactNode } from "react";
import type { Task } from "@/types";

export interface DeleteTaskDialogProps {
  task: Task;
  trigger?: ReactNode;
  onDeleted?: () => void;
}
