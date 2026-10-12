import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Priority, Project } from "@/types";
import { useInvalidate } from "./utils";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
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
      invalidate(["projects", "members", "tasks", "activity"]);
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
      invalidate(["projects", "tasks", "activity", "members"]);
      toast.success("Project deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
