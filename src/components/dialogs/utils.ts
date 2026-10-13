import type { Priority } from "@/types";

export const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

export function toIso(date: string): string | null {
  if (!date) return null;
  // Stored in UTC; the date input is local calendar day at end of day.
  return new Date(`${date}T23:59:59`).toISOString();
}

export function toInputDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.split("T")[0] || "";
}
