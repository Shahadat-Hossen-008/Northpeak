import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Priority, Project } from "@/types";
import { useInvalidate } from "./utils";
import { STALE } from "./stale-times";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    // Project edits affect shared lists, so reuse them briefly between visits.
    staleTime: STALE.normal,
    queryFn: async (): Promise<Project[]> => {
      const data = await api.getProjects();
      return (data ?? []) as Project[];
    },
  });
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
      team?: string[];
    }) => {
      return api.createProject(input);
    },
    onSuccess: () => {
      // Refresh project, member, activity, and notification views changed by creation.
      invalidate(["projects", "members", "activity", "notifications"]);
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
      // Refresh project details and related task, member, activity, and workload views.
      invalidate(["projects", "members", "tasks", "activity", "member-workload"]);
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
      // A removed project also removes its tasks, subtasks, comments, and workload entries.
      invalidate([
        "projects",
        "tasks",
        "activity",
        "members",
        "member-workload",
        "subtasks",
        "comments",
        "comment-counts",
      ]);
      toast.success("Project deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
