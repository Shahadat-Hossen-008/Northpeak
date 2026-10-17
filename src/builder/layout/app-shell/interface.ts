import type { ReactNode } from "react";
import type { AppRole } from "@/types";

export interface AppShellProps {
  section: AppRole;
  children: ReactNode;
  contentClassName?: string;
  constrainToViewport?: boolean;
}

export interface BrandProps {
  className?: string;
}
