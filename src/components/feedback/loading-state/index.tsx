import { Loader2 } from "lucide-react";
import type { LoadingStateProps } from "./interface";

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export default LoadingState;
export type { LoadingStateProps } from "./interface";
