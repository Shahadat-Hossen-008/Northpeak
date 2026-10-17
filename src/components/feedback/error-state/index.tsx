import { AlertCircle } from "lucide-react";
import type { ErrorStateProps } from "./interface";

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertCircle className="size-6 text-danger" aria-hidden />
      <h3 className="mt-3 text-base sm:text-lg font-semibold text-foreground">
        Something went wrong
      </h3>
      <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
        {message ?? "We couldn't load this data. Please refresh and try again."}
      </p>
    </div>
  );
}

export default ErrorState;
export type { ErrorStateProps } from "./interface";
