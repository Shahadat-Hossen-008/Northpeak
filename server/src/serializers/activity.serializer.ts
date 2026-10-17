export interface SerializedActivity {
  id: string;
  message: string;
  created_at: string;
  project_id: string | null;
  task_id: string | null;
  actor: { id: string; name: string } | null;
}

export function serializeActivity(a: any): SerializedActivity {
  return {
    id: a._id ? a._id.toString() : a.id ? a.id.toString() : "",
    message: a.message,
    created_at: a.createdAt
      ? a.createdAt instanceof Date
        ? a.createdAt.toISOString()
        : new Date(a.createdAt).toISOString()
      : new Date().toISOString(),
    project_id: a.project
      ? a.project._id
        ? a.project._id.toString()
        : a.project.toString()
      : null,
    task_id: a.task ? (a.task._id ? a.task._id.toString() : a.task.toString()) : null,
    actor:
      a.actor && typeof a.actor === "object" && a.actor.name
        ? {
            id: a.actor._id ? a.actor._id.toString() : a.actor.id.toString(),
            name: a.actor.name,
          }
        : null,
  };
}
