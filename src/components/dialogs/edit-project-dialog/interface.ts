import type { ReactNode } from "react";
import type { Project } from "@/types";

export interface EditProjectDialogProps {
  project: Project;
  trigger?: ReactNode;
}
