export interface SerializedSubtask {
  id: string;
  task_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  assignee: { id: string; name: string } | null;
}

export function serializeSubtask(s: any): SerializedSubtask {
  return {
    id: s._id ? s._id.toString() : s.id ? s.id.toString() : "",
    task_id: s.task ? (s.task._id ? s.task._id.toString() : s.task.toString()) : "",
    title: s.title,
    description: s.description ?? "",
    assigned_developer_id: s.assignedDeveloper
      ? s.assignedDeveloper._id
        ? s.assignedDeveloper._id.toString()
        : s.assignedDeveloper.toString()
      : null,
    is_completed: Boolean(s.isCompleted),
    completed_at: s.completedAt
      ? s.completedAt instanceof Date
        ? s.completedAt.toISOString()
        : new Date(s.completedAt).toISOString()
      : null,
    created_at: s.createdAt
      ? s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : new Date(s.createdAt).toISOString()
      : new Date().toISOString(),
    assignee:
      s.assignedDeveloper && typeof s.assignedDeveloper === "object" && s.assignedDeveloper.name
        ? {
            id: s.assignedDeveloper._id.toString(),
            name: s.assignedDeveloper.name,
          }
        : null,
  };
}
