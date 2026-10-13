import type { ReactNode } from "react";
import type { Project } from "@/types";

export interface DeleteProjectDialogProps {
  project: Project;
  trigger?: ReactNode;
  onDeleted?: () => void;
}
