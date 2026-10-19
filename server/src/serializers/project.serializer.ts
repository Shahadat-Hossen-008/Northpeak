export interface SerializedProject {
  id: string;
  title: string;
  description: string;
  manager_id: string | null;
  team: string[];
  start_date: string | null;
  deadline: string | null;
  priority: string;
  created_at: string;
  unassigned_open_tasks_count?: number;
  assignment_reconciliation_pending?: boolean;
}

export function serializeProject(p: any): SerializedProject {
  return {
    id: p._id ? p._id.toString() : p.id ? p.id.toString() : "",
    title: p.title,
    description: p.description,
    manager_id: p.manager ? p.manager.toString() : null,
    team: Array.isArray(p.team) ? p.team.map((id: any) => id.toString()) : [],
    start_date: p.startDate
      ? p.startDate instanceof Date
        ? p.startDate.toISOString()
        : new Date(p.startDate).toISOString()
      : null,
    deadline: p.deadline
      ? p.deadline instanceof Date
        ? p.deadline.toISOString()
        : new Date(p.deadline).toISOString()
      : null,
    priority: p.priority,
    created_at:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
  };
}

import {
  serializeMember as serializeProjectMember,
  type SerializedMember as SerializedProjectMember,
} from "./member.serializer.js";

export { serializeProjectMember, type SerializedProjectMember };
