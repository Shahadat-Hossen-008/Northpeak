import type { ReactNode } from "react";

export interface AuthLayoutStat {
  label: string;
  value: string;
}

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  asideTitle?: string;
  asideBody?: string;
  asideStats?: AuthLayoutStat[];
}
