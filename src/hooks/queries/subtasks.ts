import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Subtask } from "@/types";
import { useInvalidate } from "./utils";
import { STALE } from "./stale-times";

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    // Subtasks change through edits and completions, so reuse them for one minute.
    staleTime: STALE.normal,
    queryFn: async (): Promise<Subtask[]> => {
      if (!taskId) return [];
      const data = await api.getSubtasks(taskId);
      return (data ?? []) as Subtask[];
    },
    enabled: Boolean(taskId),
  });
}

export function useAllSubtasks() {
  return useQuery({
    queryKey: ["subtasks", "all"],
    // The aggregate follows subtask edits but does not need a live feed interval.
    staleTime: STALE.normal,
    queryFn: async (): Promise<Subtask[]> => {
      const data = await api.getAllSubtasks();
      return (data ?? []) as Subtask[];
    },
  });
}

export function useSubtaskMutations(taskId: string, _actorId?: string | null, _projectId?: string) {
  const invalidate = useInvalidate();

  const add = useMutation({
    mutationFn: async (input: { title: string; description?: string }) => {
      return api.createSubtask(taskId, input);
    },
    onSuccess: () => {
      // Refresh subtask views, activity, and workload because workload shows subtask counts.
      invalidate(["subtasks", "activity", "member-workload"]);
      toast.success("Subtask added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (subtask: Subtask) => {
      const completed = !subtask.is_completed;
      return api.updateSubtask(subtask.id, { is_completed: completed });
    },
    // Completion changes subtask views, notifications, and workload completion counts.
    onSuccess: () => invalidate(["subtasks", "notifications", "member-workload"]),
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: async ({
      id,
      title,
      description,
      assigned_developer_id,
    }: {
      id: string;
      title: string;
      description?: string;
      assigned_developer_id?: string | null;
    }) => {
      return api.updateSubtask(id, {
        title,
        ...(description !== undefined ? { description } : {}),
        ...(assigned_developer_id !== undefined ? { assigned_developer_id } : {}),
      });
    },
    // Refresh subtask text and workload because reassignment can change its task entries.
    onSuccess: () => invalidate(["subtasks", "member-workload"]),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteSubtask(id);
    },
    onSuccess: () => {
      // Remove the deleted subtask from lists and workload counts.
      invalidate(["subtasks", "member-workload"]);
      toast.success("Subtask deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, toggle, rename, remove };
}
