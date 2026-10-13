import * as React from "react";

export type CircularProgressTone =
  "auto" | "primary" | "success" | "danger" | "neutral" | "info" | "warning";

export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number | null | undefined;
  size?: number | undefined;
  strokeWidth?: number | undefined;
  showValue?: boolean | undefined;
  ariaLabel?: string | undefined;
  tone?: CircularProgressTone | undefined;
  strokeColor?: string | undefined;
}
