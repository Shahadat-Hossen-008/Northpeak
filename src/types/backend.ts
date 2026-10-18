import type { AppRole, Priority, TaskWorkflowStatus } from "./frontend";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

export interface Profile {
  id: string;
  name: string;
  email: string | null;
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  role: AppRole | null;
  created_at?: string;
}

export interface MemberWorkloadTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  deadline: string | null;
  priority: Priority;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  status: string;
  project: { id: string; title: string } | null;
  subtasks_count: number;
  subtasks_completed_count: number;
}

export interface MemberWorkload {
  member: Member;
  stats: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
    workload_percentage: number;
  };
  tasks: MemberWorkloadTask[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  manager_id: string | null;
  team?: string[];
  start_date: string | null;
  deadline: string | null;
  priority: Priority;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  deadline: string | null;
  priority: Priority;
  status: TaskWorkflowStatus;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  project: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
  created_by?: { id: string; name: string } | null;
  assigned_by?: { id: string; name: string } | null;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at?: string;
  assignee: { id: string; name: string } | null;
}

export interface Comment {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
  updated_at?: string;
  author: { id: string; name: string } | null;
}

export interface ActivityItem {
  id: string;
  message: string;
  created_at: string;
  project_id: string | null;
  task_id: string | null;
  actor: { id: string; name: string } | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  task_id: string | null;
  project_id: string | null;
}
