import type { LucideIcon } from "lucide-react";

export type StatTone = "neutral" | "success" | "danger" | "warning" | "primary";

export interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
}
