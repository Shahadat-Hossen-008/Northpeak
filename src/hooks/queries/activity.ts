import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/types";

export function useActivity(filter?: { projectId?: string; taskId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["activity", filter?.projectId ?? null, filter?.taskId ?? null],
    queryFn: async (): Promise<ActivityItem[]> => {
      const data = await api.getActivity(filter);
      return (data ?? []) as ActivityItem[];
    },
  });
}
