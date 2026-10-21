import { queryOptions } from "@tanstack/react-query";
import { api, getAuthTokenRevision } from "@/lib/api";

export const currentUserQueryKey = ["current-user"] as const;

export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: [...currentUserQueryKey, getAuthTokenRevision()] as const,
    queryFn: () => api.getMe(),
    staleTime: 10_000,
    retry: false,
  });
}
