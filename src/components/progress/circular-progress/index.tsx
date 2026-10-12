import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CircularProgressProps } from "./interface";

export function CircularProgress({
  value,
  size = 36,
  strokeWidth = 3.5,
  showValue = true,
  ariaLabel,
  tone = "auto",
  strokeColor,
  className,
  ...props
}: CircularProgressProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const safeVal = Math.min(
    100,
    Math.max(0, typeof value === "number" && !isNaN(value) ? Math.round(value) : 0),
  );

  let strokeClass = "stroke-primary text-primary";
  if (tone === "neutral" || (tone === "auto" && safeVal === 0)) {
    strokeClass = "stroke-muted-foreground/35 text-muted-foreground";
  } else if (tone === "success" || (tone === "auto" && safeVal >= 100)) {
    strokeClass = "stroke-success text-success";
  } else if (tone === "danger") {
    strokeClass = "stroke-danger text-danger";
  } else if (tone === "info") {
    strokeClass = "stroke-info text-info";
  } else if (tone === "warning") {
    strokeClass = "stroke-warning text-warning";
  } else if (tone === "primary") {
    strokeClass = "stroke-primary text-primary";
  }

  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (safeVal / 100) * circumference;
  const strokeDashoffset = isMounted ? targetOffset : circumference;

  let textClass = "text-[10px] font-bold";
  if (size >= 64) {
    textClass = "text-base font-bold";
  } else if (size >= 48) {
    textClass = "text-xs font-bold";
  } else if (size <= 32) {
    textClass = "text-[9px] font-bold";
  }

  const label = ariaLabel || `${safeVal}% completed`;

  return (
    <div
      role="progressbar"
      aria-valuenow={safeVal}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="stroke-muted/30"
        />
        {safeVal > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor || "currentColor"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              "transition-[stroke-dashoffset] duration-600 ease-out motion-reduce:transition-none",
              !strokeColor && strokeClass,
            )}
          />
        ) : null}
      </svg>

      {showValue && size >= 30 ? (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center select-none tabular",
            textClass,
            safeVal >= 100
              ? "text-success"
              : safeVal > 0
                ? "text-foreground"
                : "text-muted-foreground",
          )}
        >
          {safeVal >= 100 && size <= 34 ? (
            <Check className="size-3 text-success stroke-[3]" aria-hidden="true" />
          ) : (
            `${safeVal}%`
          )}
        </span>
      ) : null}
    </div>
  );
}

export default CircularProgress;
export type { CircularProgressProps, CircularProgressTone } from "./interface";
