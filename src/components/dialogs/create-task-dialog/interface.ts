import type { ReactNode } from "react";
import type { Member, Project, TaskWorkflowStatus } from "@/types";

export interface CreateTaskDialogProps {
  actorId: string | null;
  projects: Project[];
  developers?: Member[];
  defaultProjectId?: string | undefined;
  defaultStatus?: TaskWorkflowStatus | undefined;
  trigger?: ReactNode;
}
