import type { ReactNode } from "react";
import type { AppRole } from "@/types";

export interface AppShellProps {
  section: AppRole;
  children: ReactNode;
}

export interface BrandProps {
  className?: string;
}
