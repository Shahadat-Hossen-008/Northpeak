import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type MemberWorkload, type MemberWorkloadTask } from "@/lib/api";
import type { AppRole } from "@/hooks/useAuth";

export type { MemberWorkload, MemberWorkloadTask };

export type Priority = "low" | "medium" | "high" | "critical";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  role: AppRole | null;
  created_at?: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  manager_id: string | null;
  start_date: string | null;
  deadline: string | null;
  priority: Priority;
  created_at: string;
};

export type TaskWorkflowStatus = "todo" | "in_progress" | "in_review" | "done";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  deadline: string | null;
  priority: Priority;
  status: TaskWorkflowStatus;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  project: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
  author: { id: string; name: string } | null;
};

export type ActivityItem = {
  id: string;
  message: string;
  created_at: string;
  project_id: string | null;
  task_id: string | null;
  actor: { id: string; name: string } | null;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  task_id: string | null;
  project_id: string | null;
};

/* ------------------------------- queries ------------------------------- */

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async (): Promise<Member[]> => {
      const data = await api.getMembers();
      return (data || []) as Member[];
    },
  });
}

export function useMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["member", memberId],
    queryFn: async (): Promise<Member | null> => {
      if (!memberId) return null;
      const data = await api.getMember(memberId);
      return data ?? null;
    },
    enabled: Boolean(memberId),
  });
}

export function useMemberWorkload(memberId: string | null | undefined, projectId?: string) {
  return useQuery({
    queryKey: ["member-workload", memberId, projectId ?? null],
    queryFn: async (): Promise<MemberWorkload | null> => {
      if (!memberId) return null;
      const data = await api.getMemberWorkload(memberId, projectId);
      return data ?? null;
    },
    enabled: Boolean(memberId),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const data = await api.getProjects();
      return (data || []) as Project[];
    },
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> => {
      const data = await api.getTasks();
      return (data || []) as Task[];
    },
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: async (): Promise<Task | null> => {
      if (!taskId) return null;
      const data = await api.getTask(taskId);
      return (data as Task | null) ?? null;
    },
    enabled: Boolean(taskId),
  });
}

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: async (): Promise<Subtask[]> => {
      if (!taskId) return [];
      const data = await api.getSubtasks(taskId);
      return (data || []) as Subtask[];
    },
    enabled: Boolean(taskId),
  });
}

export function useAllSubtasks() {
  return useQuery({
    queryKey: ["subtasks", "all"],
    queryFn: async (): Promise<Subtask[]> => {
      const data = await api.getAllSubtasks();
      return (data || []) as Subtask[];
    },
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async (): Promise<Comment[]> => {
      if (!taskId) return [];
      const data = await api.getComments(taskId);
      return (data || []) as Comment[];
    },
    enabled: Boolean(taskId),
  });
}

export function useCommentCounts() {
  return useQuery({
    queryKey: ["comment-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const data = await api.getCommentCounts();
      return data || {};
    },
  });
}

export function useActivity(filter?: { projectId?: string; taskId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["activity", filter?.projectId ?? null, filter?.taskId ?? null],
    queryFn: async (): Promise<ActivityItem[]> => {
      const data = await api.getActivity(filter);
      return (data || []) as ActivityItem[];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<AppNotification[]> => {
      const data = await api.getNotifications();
      return (data || []) as AppNotification[];
    },
  });
}

/* ------------------------------ mutations ------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient();
  return (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateProject(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      start_date: string | null;
      deadline: string | null;
      priority: Priority;
    }) => {
      return api.createProject(input);
    },
    onSuccess: () => {
      invalidate(["projects", "activity", "notifications"]);
      toast.success("Project created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProject(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Project>) => {
      return api.updateProject(id, patch);
    },
    onSuccess: () => {
      invalidate(["projects", "activity"]);
      toast.success("Project updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      return api.deleteProject(id);
    },
    onSuccess: () => {
      invalidate(["projects", "tasks", "subtasks", "activity", "notifications"]);
      toast.success("Project deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateTask(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      description: string;
      assigned_developer_id: string | null;
      deadline: string | null;
      priority: Priority;
      status?: TaskWorkflowStatus;
    }) => {
      return api.createTask(input);
    },
    onSuccess: () => {
      invalidate(["tasks", "activity", "notifications", "member-workload"]);
      toast.success("Task created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetTaskCompletion(_actorId?: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      task: { id: string; title: string; project_id: string };
      completed: boolean;
    }) => {
      return api.setTaskCompletion(input.task.id, input.completed);
    },
    onSuccess: (_data, variables) => {
      invalidate(["tasks", "task", "activity", "member-workload"]);
      toast.success(variables.completed ? "Task marked complete" : "Task reopened");
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
      invalidate(["tasks", "task", "activity", "notifications", "member-workload"]);
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
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

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

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      toast.error("Failed to move task");
    },
    onSettled: () => {
      invalidate(["tasks", "task", "activity", "member-workload"]);
    },
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      return api.deleteTask(id);
    },
    onSuccess: () => {
      invalidate(["tasks", "activity", "member-workload"]);
      toast.success("Task deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSubtaskMutations(taskId: string, _actorId?: string | null, _projectId?: string) {
  const invalidate = useInvalidate();

  const add = useMutation({
    mutationFn: async (title: string) => {
      return api.createSubtask(taskId, title);
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
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      return api.updateSubtask(id, { title });
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

export function useDeleteComment(taskId: string) {
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
