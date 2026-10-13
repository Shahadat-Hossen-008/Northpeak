import type { AppRole } from "@/types";

export function homePathForRole(role: AppRole | null): string {
  return role === "developer" ? "/developer/dashboard" : "/manager/dashboard";
}
