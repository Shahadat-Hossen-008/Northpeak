import { request } from "./client";
import type { Task } from "@/types";

export const tasksApi = {
  async getTasks() {
    return request<Task[]>("/tasks");
  },

  async getTask(id: string) {
    return request<Task>(`/tasks/${id}`);
  },

  async createTask(payload: {
    project_id: string;
    title: string;
    description?: string | undefined;
    assigned_developer_id?: string | null | undefined;
    deadline?: string | null | undefined;
    priority?: string | undefined;
    status?: string | undefined;
  }) {
    return request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateTask(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      assigned_developer_id: string | null;
      deadline: string | null;
      priority: string;
      status: string;
      is_completed: boolean;
    }>,
  ) {
    return request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async setTaskCompletion(id: string, completed: boolean) {
    return request<Task>(`/tasks/${id}/complete`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
  },

  async deleteTask(id: string) {
    return request<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  },
};
