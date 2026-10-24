import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AppNotification } from "@/types";
import { useInvalidate } from "./utils";
import { STALE } from "./stale-times";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    // Other users and background actions can add notifications during a session.
    staleTime: STALE.live,
    queryFn: async (): Promise<AppNotification[]> => {
      const data = await api.getNotifications();
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useMarkNotifications() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      return api.markNotifications(ids);
    },
    // Refresh notification badges and lists after read state changes.
    onSuccess: () => invalidate(["notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });
}
