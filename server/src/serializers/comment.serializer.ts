export interface SerializedComment {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: { id: string; name: string } | null;
}

export function serializeComment(c: any): SerializedComment {
  return {
    id: c._id ? c._id.toString() : c.id ? c.id.toString() : "",
    task_id: c.task ? (c.task._id ? c.task._id.toString() : c.task.toString()) : "",
    body: c.body,
    created_at: c.createdAt
      ? c.createdAt instanceof Date
        ? c.createdAt.toISOString()
        : new Date(c.createdAt).toISOString()
      : new Date().toISOString(),
    updated_at: c.updatedAt
      ? c.updatedAt instanceof Date
        ? c.updatedAt.toISOString()
        : new Date(c.updatedAt).toISOString()
      : new Date().toISOString(),
    author:
      c.author && typeof c.author === "object" && c.author.name
        ? { id: c.author._id ? c.author._id.toString() : c.author.id.toString(), name: c.author.name }
        : null,
  };
}
