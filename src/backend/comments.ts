import { request } from "./client";
import type { Comment } from "@/types";

export const commentsApi = {
  async getComments(taskId: string) {
    return request<Comment[]>(`/comments/task/${taskId}`);
  },

  async getCommentCounts() {
    return request<Record<string, number>>("/comments/counts");
  },

  async addComment(taskId: string, body: string) {
    return request<Comment>(`/comments/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  async updateComment(id: string, body: string) {
    return request<Comment>(`/comments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  },

  async deleteComment(id: string) {
    return request<{ success: boolean; message: string }>(`/comments/${id}`, {
      method: "DELETE",
    });
  },
};
