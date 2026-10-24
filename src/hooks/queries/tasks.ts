import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Priority, Task, TaskWorkflowStatus } from "@/types";
import { useInvalidate } from "./utils";
import { STALE } from "./stale-times";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    // Task lists change through edits, so reuse them briefly between visits.
    staleTime: STALE.normal,
    queryFn: async (): Promise<Task[]> => {
      const data = await api.getTasks();
      return (data ?? []) as Task[];
    },
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    // Task details share the same edit cadence as task lists.
    staleTime: STALE.normal,
    queryFn: async (): Promise<Task | null> => {
      if (!taskId) return null;
      const data = await api.getTask(taskId);
      return (data as Task | null) ?? null;
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateTask(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      description?: string | undefined;
      assigned_developer_id?: string | null | undefined;
      priority: Priority;
      deadline?: string | null | undefined;
      status?: TaskWorkflowStatus | undefined;
    }) => {
      return api.createTask({
        ...input,
        description: input.description ?? "",
      });
    },
    onSuccess: () => {
      // Refresh task, project, member, activity, notification, and workload views affected by creation.
      invalidate(["tasks", "projects", "members", "activity", "notifications", "member-workload"]);
      toast.success("Task created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTask(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({
      id,
      projectId: _projectId,
      ...patch
    }: {
      id: string;
      projectId?: string;
      title?: string;
      description?: string;
      assigned_developer_id?: string | null;
      deadline?: string | null;
      priority?: Priority;
      status?: TaskWorkflowStatus;
      is_completed?: boolean;
    } & Record<string, unknown>) => {
      return api.updateTask(id, patch);
    },
    onSuccess: () => {
      // Refresh task details and every shared list or summary that displays edited task data.
      invalidate([
        "tasks",
        "task",
        "projects",
        "members",
        "activity",
        "notifications",
        "member-workload",
      ]);
      toast.success("Task updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskWorkflowStatus }) => {
      return api.updateTask(id, {
        status,
        is_completed: status === "done",
      });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      await queryClient.cancelQueries({ queryKey: ["task", id] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);
      const previousTask = queryClient.getQueryData<Task>(["task", id]);

      queryClient.setQueryData<Task[]>(["tasks"], (old) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                is_completed: status === "done",
                completed_at: status === "done" ? new Date().toISOString() : null,
              }
            : t,
        );
      });

      queryClient.setQueryData<Task | null>(["task", id], (old) => {
        if (!old) return old;
        return {
          ...old,
          status,
          is_completed: status === "done",
          completed_at: status === "done" ? new Date().toISOString() : null,
        };
      });

      return { previousTasks, previousTask };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(["task", id], context.previousTask);
      }
      toast.error("Failed to move task");
    },
    onSettled: () => {
      // Reconcile optimistic task data with lists, activity, and workload summaries.
      invalidate(["tasks", "task", "activity", "member-workload"]);
    },
  });
}

export function useSetTaskCompletion(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      task: { id: string; title?: string; project_id?: string };
      completed: boolean;
    }) => {
      return api.setTaskCompletion(input.task.id, input.completed);
    },
    onSuccess: (_data, variables) => {
      // Completion changes task lists, activity, and workload totals.
      invalidate(["tasks", "task", "activity", "member-workload"]);
      toast.success(variables.completed ? "Task marked complete" : "Task reopened");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (idOrTask: string | { id: string }) => {
      const id = typeof idOrTask === "string" ? idOrTask : idOrTask.id;
      return api.deleteTask(id);
    },
    onSuccess: () => {
      // Remove task-related rows and counts from every cached view that can display them.
      invalidate([
        "tasks",
        "task",
        "projects",
        "members",
        "activity",
        "notifications",
        "comments",
        "comment-counts",
        "subtasks",
        "member-workload",
      ]);
      toast.success("Task deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
