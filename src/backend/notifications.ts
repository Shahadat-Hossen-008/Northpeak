import { request } from "./client";
import type { AppNotification } from "@/types";

export const notificationsApi = {
  async getNotifications() {
    return request<AppNotification[]>("/notifications");
  },

  async markNotifications(ids: string[]) {
    return request<{ success: boolean }>("/notifications/mark-read", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
  },
};
