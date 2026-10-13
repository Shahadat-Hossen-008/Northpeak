import { request } from "./client";
import type { Member, MemberWorkload } from "@/types";

export const membersApi = {
  async getMembers(projectId?: string) {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return request<Member[]>(`/members${query}`);
  },

  async getMember(id: string) {
    return request<Member>(`/members/${id}`);
  },

  async getMemberWorkload(id: string, projectId?: string) {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return request<MemberWorkload>(`/members/${id}/workload${query}`);
  },
};
