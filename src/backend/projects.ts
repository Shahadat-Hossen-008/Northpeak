import { request } from "./client";
import type { Project } from "@/types";

export const projectsApi = {
  async getProjects() {
    return request<Project[]>("/projects");
  },

  async getProject(id: string) {
    return request<Project>(`/projects/${id}`);
  },

  async createProject(payload: {
    title: string;
    description: string;
    start_date: string | null;
    deadline: string | null;
    priority: string;
    team?: string[];
  }) {
    return request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateProject(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      start_date: string | null;
      deadline: string | null;
      priority: string;
      team: string[];
    }>,
  ) {
    return request<Project & { unassigned_open_tasks_count?: number }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteProject(id: string) {
    return request<{ success: boolean; message: string }>(`/projects/${id}`, {
      method: "DELETE",
    });
  },
};
