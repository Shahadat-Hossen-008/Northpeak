export type MetricTone = "primary" | "success" | "info" | "danger" | "warning" | "neutral";

export interface DashboardMetricCardProps {
  title: string;
  value: number; // Percentage (0 - 100)
  countSummary: string; // e.g. "Total Tasks · 24", "Completed · 6"
  tone?: MetricTone | undefined;
  strokeColor?: string | undefined;
  className?: string | undefined;
}
