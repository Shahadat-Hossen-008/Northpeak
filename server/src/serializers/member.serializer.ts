export interface SerializedMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export function serializeMember(u: any): SerializedMember {
  return {
    id: u._id ? u._id.toString() : u.id ? u.id.toString() : "",
    name: u.name,
    email: u.email,
    role: u.role,
    created_at: u.createdAt
      ? u.createdAt instanceof Date
        ? u.createdAt.toISOString()
        : new Date(u.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export interface MemberWorkloadTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  status: string;
  workflow_status: string;
  project: { id: string; title: string } | null;
  subtasks_count: number;
  subtasks_completed_count: number;
}

export interface MemberWorkloadStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  workload_percentage: number;
}

export interface SerializedMemberWorkload {
  member: SerializedMember;
  stats: MemberWorkloadStats;
  tasks: MemberWorkloadTask[];
}
