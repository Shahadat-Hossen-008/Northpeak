import { queryOptions } from "@tanstack/react-query";
import { api, getAuthTokenRevision } from "@/lib/api";
import { STALE } from "./stale-times";

export const currentUserQueryKey = ["current-user"] as const;

export function currentUserQueryOptions() {
  return queryOptions({
    queryKey: [...currentUserQueryKey, getAuthTokenRevision()] as const,
    queryFn: () => api.getMe(),
    // A 401 ends expired sessions; login and profile reloads force a fresh fetch.
    staleTime: STALE.static,
    retry: false,
  });
}
