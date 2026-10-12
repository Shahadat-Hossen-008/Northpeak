import type { Project, Task } from "@/types";

export interface ProjectCardProps {
  project: Project;
  tasks: Task[];
  href: string;
}
