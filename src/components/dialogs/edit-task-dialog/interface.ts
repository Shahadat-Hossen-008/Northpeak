import type { ReactNode } from "react";
import type { Member, Task } from "@/types";

export interface EditTaskDialogProps {
  task: Task;
  developers?: Member[];
  trigger?: ReactNode;
}
