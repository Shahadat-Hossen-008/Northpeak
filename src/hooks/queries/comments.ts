import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Comment } from "@/types";
import { useInvalidate } from "./utils";

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async (): Promise<Comment[]> => {
      if (!taskId) return [];
      const data = await api.getComments(taskId);
      return (data ?? []) as Comment[];
    },
    enabled: Boolean(taskId),
  });
}

export function useCommentCounts() {
  return useQuery({
    queryKey: ["comment-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const data = await api.getCommentCounts();
      return data ?? {};
    },
  });
}

export function useAddComment(taskId: string, _actorId?: string | null, _projectId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: string) => {
      return api.addComment(taskId, body);
    },
    onSuccess: () => invalidate(["comments", "comment-counts", "activity", "notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteComment(_taskId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (commentId: string) => {
      return api.deleteComment(commentId);
    },
    onSuccess: () => {
      invalidate(["comments", "comment-counts"]);
      toast.success("Comment deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
