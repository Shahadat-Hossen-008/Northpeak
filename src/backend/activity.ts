import { request } from "./client";
import type { ActivityItem } from "@/types";

export const activityApi = {
  async getActivity(filter?: { projectId?: string; taskId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filter?.projectId) params.append("projectId", filter.projectId);
    if (filter?.taskId) params.append("taskId", filter.taskId);
    if (filter?.limit) params.append("limit", filter.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<ActivityItem[]>(`/activity${query}`);
  },
};
