import type { DeadlineState } from "@/types";

export interface DeadlineBadgeProps {
  deadline: string | null;
  state: DeadlineState;
  className?: string;
}
