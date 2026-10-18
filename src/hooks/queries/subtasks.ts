import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Subtask } from "@/types";
import { useInvalidate } from "./utils";

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: ["subtasks", taskId],
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
      invalidate(["subtasks", "activity"]);
      toast.success("Subtask added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (subtask: Subtask) => {
      const completed = !subtask.is_completed;
      return api.updateSubtask(subtask.id, { is_completed: completed });
    },
    onSuccess: () => invalidate(["subtasks", "notifications"]),
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
    onSuccess: () => invalidate(["subtasks"]),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteSubtask(id);
    },
    onSuccess: () => {
      invalidate(["subtasks"]);
      toast.success("Subtask deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, toggle, rename, remove };
}
