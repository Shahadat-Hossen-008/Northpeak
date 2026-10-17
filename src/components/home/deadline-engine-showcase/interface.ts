import type { DeadlineState } from "@/types/frontend";

export interface DeadlineEngineShowcaseProps {
  variant?: "compact" | "full";
  selectedState?: DeadlineState | null;
  onSelectState?: (state: DeadlineState | null) => void;
  className?: string;
}
