export type ProgressTone = "primary" | "success" | "danger" | "warning";

export interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  className?: string;
}
