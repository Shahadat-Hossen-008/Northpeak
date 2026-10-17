export interface SerializedNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  task_id: string | null;
  project_id: string | null;
}

export function serializeNotification(n: any): SerializedNotification {
  return {
    id: n._id ? n._id.toString() : n.id ? n.id.toString() : "",
    kind: n.kind,
    title: n.title,
    body: n.body,
    is_read: Boolean(n.isRead),
    created_at: n.createdAt
      ? n.createdAt instanceof Date
        ? n.createdAt.toISOString()
        : new Date(n.createdAt).toISOString()
      : new Date().toISOString(),
    task_id: n.task ? (n.task._id ? n.task._id.toString() : n.task.toString()) : null,
    project_id: n.project ? (n.project._id ? n.project._id.toString() : n.project.toString()) : null,
  };
}
