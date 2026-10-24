import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Member, MemberWorkload } from "@/types";
import { STALE } from "./stale-times";

export function useMembers(projectId?: string | null) {
  return useQuery({
    queryKey: projectId ? ["members", { projectId }] : ["members"],
    // Member lists change infrequently, so reuse them across short page visits.
    staleTime: STALE.static,
    queryFn: async (): Promise<Member[]> => {
      const data = await api.getMembers(projectId || undefined);
      return (data ?? []) as Member[];
    },
    enabled: projectId !== null,
  });
}

export function useMember(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["member", memberId],
    // Member profiles change infrequently compared with task activity.
    staleTime: STALE.static,
    queryFn: async (): Promise<Member | null> => {
      if (!memberId) return null;
      const data = await api.getMember(memberId);
      return data ?? null;
    },
    enabled: Boolean(memberId),
  });
}

export function useMemberWorkload(memberId: string | null | undefined, projectId?: string) {
  return useQuery({
    queryKey: ["member-workload", memberId, projectId ?? null],
    // Workload follows task and subtask edits, so refresh it more often than profiles.
    staleTime: STALE.normal,
    queryFn: async (): Promise<MemberWorkload | null> => {
      if (!memberId) return null;
      const data = await api.getMemberWorkload(memberId, projectId);
      return data ?? null;
    },
    enabled: Boolean(memberId),
  });
}
