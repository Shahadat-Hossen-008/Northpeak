import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AppNotification } from "@/types";
import { useInvalidate } from "./utils";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
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
    onSuccess: () => invalidate(["notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });
}
