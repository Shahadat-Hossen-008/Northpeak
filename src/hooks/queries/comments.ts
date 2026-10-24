import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Comment } from "@/types";
import { useInvalidate } from "./utils";
import { STALE } from "./stale-times";

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    // Comments can arrive from other users while this task stays open.
    staleTime: STALE.live,
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
    // Comment counts change with comments across tasks, so keep this aggregate fresh.
    staleTime: STALE.live,
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
    // Refresh comment views, counts, and the feeds that report new comments.
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
      // Refresh comment lists and their counts after a comment is removed.
      invalidate(["comments", "comment-counts"]);
      toast.success("Comment deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateComment(_taskId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      return api.updateComment(id, body);
    },
    onSuccess: () => {
      // Refresh comment lists because their displayed body changed.
      invalidate(["comments"]);
      toast.success("Comment updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
