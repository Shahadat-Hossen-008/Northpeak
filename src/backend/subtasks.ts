import { request } from "./client";
import type { Subtask } from "@/types";

export const subtasksApi = {
  async getAllSubtasks() {
    return request<Subtask[]>("/subtasks");
  },

  async getSubtasks(taskId: string) {
    return request<Subtask[]>(`/subtasks/task/${taskId}`);
  },

  async createSubtask(taskId: string, title: string) {
    return request<Subtask>(`/subtasks/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async updateSubtask(id: string, patch: { title?: string; is_completed?: boolean }) {
    return request<Subtask>(`/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteSubtask(id: string) {
    return request<{ success: boolean; message: string }>(`/subtasks/${id}`, {
      method: "DELETE",
    });
  },
};
