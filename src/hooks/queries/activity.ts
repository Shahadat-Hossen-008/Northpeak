import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/types";
import { STALE } from "./stale-times";

export function useActivity(
  filter?: { projectId?: string; taskId?: string; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "activity",
      filter?.projectId ?? null,
      filter?.taskId ?? null,
      filter?.limit ?? null,
    ],
    // Activity is produced by other users' changes, so refresh it sooner than task data.
    staleTime: STALE.live,
    queryFn: async (): Promise<ActivityItem[]> => {
      const data = await api.getActivity(filter);
      return (data ?? []) as ActivityItem[];
    },
    enabled,
  });
}
