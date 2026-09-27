import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

export type Priority = "low" | "medium" | "high" | "critical";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  role: AppRole | null;
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

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  deadline: string | null;
  priority: Priority;
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

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

/* ------------------------------- queries ------------------------------- */

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async (): Promise<Member[]> => {
      const profiles = unwrap(
        await supabase.from("profiles").select("id, name, email").order("name"),
      ) as Omit<Member, "role">[];
      const roles = unwrap(await supabase.from("user_roles").select("user_id, role")) as {
        user_id: string;
        role: AppRole;
      }[];
      const map = new Map(roles.map((r) => [r.user_id, r.role]));
      return profiles.map((p) => ({ ...p, role: map.get(p.id) ?? null }));
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> =>
      unwrap(
        await supabase.from("projects").select("*").order("created_at", { ascending: false }),
      ) as Project[],
  });
}

const TASK_SELECT =
  "*, project:projects(id, title), assignee:profiles!tasks_assigned_developer_id_fkey(id, name)";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<Task[]> =>
      unwrap(
        await supabase.from("tasks").select(TASK_SELECT).order("deadline", { ascending: true }),
      ) as Task[],
  });
}

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("id", taskId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Task | null) ?? null;
    },
  });
}

export function useSubtasks(taskId: string) {
  return useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: async (): Promise<Subtask[]> =>
      unwrap(
        await supabase
          .from("subtasks")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true }),
      ) as Subtask[],
  });
}

export function useAllSubtasks() {
  return useQuery({
    queryKey: ["subtasks", "all"],
    queryFn: async (): Promise<Subtask[]> =>
      unwrap(await supabase.from("subtasks").select("*")) as Subtask[],
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async (): Promise<Comment[]> =>
      unwrap(
        await supabase
          .from("comments")
          .select("id, task_id, body, created_at, author:profiles!comments_author_id_fkey(id, name)")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true }),
      ) as Comment[],
  });
}

export function useCommentCounts() {
  return useQuery({
    queryKey: ["comment-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const rows = unwrap(await supabase.from("comments").select("task_id")) as {
        task_id: string;
      }[];
      const counts: Record<string, number> = {};
      for (const row of rows) counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
      return counts;
    },
  });
}

export function useActivity(filter?: { projectId?: string; taskId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["activity", filter?.projectId ?? null, filter?.taskId ?? null],
    queryFn: async (): Promise<ActivityItem[]> => {
      let query = supabase
        .from("activity")
        .select(
          "id, message, created_at, project_id, task_id, actor:profiles!activity_actor_id_fkey(id, name)",
        )
        .order("created_at", { ascending: false })
        .limit(filter?.limit ?? 20);
      if (filter?.projectId) query = query.eq("project_id", filter.projectId);
      if (filter?.taskId) query = query.eq("task_id", filter.taskId);
      return unwrap(await query) as ActivityItem[];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<AppNotification[]> =>
      unwrap(
        await supabase
          .from("notifications")
          .select("id, kind, title, body, is_read, created_at, task_id, project_id")
          .order("created_at", { ascending: false })
          .limit(50),
      ) as AppNotification[],
  });
}

/* ------------------------------ mutations ------------------------------ */

function useInvalidate() {
  const queryClient = useQueryClient();
  return (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

async function logActivity(input: {
  actorId: string | null;
  projectId?: string | null | undefined;
  taskId?: string | null;
  message: string;
}) {
  await supabase.from("activity").insert({
    actor_id: input.actorId,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    message: input.message,
  });
}

export function useCreateProject(actorId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      start_date: string | null;
      deadline: string | null;
      priority: Priority;
    }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...input, manager_id: actorId })
        .select("id, title")
        .single();
      if (error) throw new Error(error.message);
      await logActivity({
        actorId,
        projectId: data.id,
        message: `created project ${data.title}`,
      });
      await supabase.from("notifications").insert({
        audience: "manager",
        kind: "project_created",
        title: "Project created",
        body: `${data.title} was created.`,
        project_id: data.id,
      });
      return data;
    },
    onSuccess: () => {
      invalidate(["projects", "activity", "notifications"]);
      toast.success("Project created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProject(actorId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Project>) => {
      const { error } = await supabase.from("projects").update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
      await logActivity({ actorId, projectId: id, message: "updated the project details" });
    },
    onSuccess: () => {
      invalidate(["projects", "activity"]);
      toast.success("Project updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateTask(actorId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      description: string;
      assigned_developer_id: string | null;
      deadline: string | null;
      priority: Priority;
    }) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert(input)
        .select("id, title, project_id")
        .single();
      if (error) throw new Error(error.message);
      await logActivity({
        actorId,
        projectId: data.project_id,
        taskId: data.id,
        message: `created task ${data.title}`,
      });
      return data;
    },
    onSuccess: () => {
      invalidate(["tasks", "activity", "notifications"]);
      toast.success("Task created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetTaskCompletion(actorId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      task: { id: string; title: string; project_id: string };
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          is_completed: input.completed,
          completed_at: input.completed ? new Date().toISOString() : null,
        })
        .eq("id", input.task.id);
      if (error) throw new Error(error.message);
      await logActivity({
        actorId,
        projectId: input.task.project_id,
        taskId: input.task.id,
        message: `${input.completed ? "completed" : "reopened"} ${input.task.title}`,
      });
    },
    onSuccess: (_data, variables) => {
      invalidate(["tasks", "task", "activity"]);
      toast.success(variables.completed ? "Task marked complete" : "Task reopened");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTask(actorId: string | null) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, projectId, ...patch }: { id: string; projectId: string } & Record<string, unknown>) => {
      const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
      await logActivity({ actorId, projectId, taskId: id, message: "updated a task" });
    },
    onSuccess: () => {
      invalidate(["tasks", "task", "activity", "notifications"]);
      toast.success("Task updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate(["tasks", "activity"]);
      toast.success("Task deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSubtaskMutations(taskId: string, actorId: string | null, projectId?: string) {
  const invalidate = useInvalidate();

  const add = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("subtasks").insert({ task_id: taskId, title });
      if (error) throw new Error(error.message);
      await logActivity({ actorId, projectId, taskId, message: `added subtask ${title}` });
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
      const { error } = await supabase
        .from("subtasks")
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", subtask.id);
      if (error) throw new Error(error.message);
      if (completed) {
        await supabase.from("notifications").insert({
          audience: "manager",
          kind: "subtask_completed",
          title: "Subtask completed",
          body: `${subtask.title} was marked complete.`,
          task_id: taskId,
          project_id: projectId ?? null,
        });
      }
    },
    onSuccess: () => invalidate(["subtasks", "notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("subtasks").update({ title }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(["subtasks"]),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate(["subtasks"]);
      toast.success("Subtask deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, toggle, rename, remove };
}

export function useAddComment(taskId: string, actorId: string | null, projectId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("comments")
        .insert({ task_id: taskId, author_id: actorId, body });
      if (error) throw new Error(error.message);
      await logActivity({ actorId, projectId, taskId, message: "added a comment" });
    },
    onSuccess: () => invalidate(["comments", "comment-counts", "activity", "notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useMarkNotifications() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidate(["notifications"]),
    onError: (error: Error) => toast.error(error.message),
  });
}
