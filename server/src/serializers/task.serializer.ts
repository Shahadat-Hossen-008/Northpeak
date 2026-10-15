export interface SerializedTask {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_developer_id: string | null;
  deadline: string | null;
  priority: string;
  status: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  project?: { id: string; title: string } | null;
  assignee?: { id: string; name: string } | null;
}

export function serializeTask(task: any): SerializedTask {
  return {
    id: task._id ? task._id.toString() : task.id ? task.id.toString() : "",
    project_id: task.project?._id ? task.project._id.toString() : task.project?.toString() || "",
    title: task.title,
    description: task.description || "",
    assigned_developer_id: task.assignedDeveloper?._id
      ? task.assignedDeveloper._id.toString()
      : task.assignedDeveloper
        ? task.assignedDeveloper.toString()
        : null,
    deadline: task.deadline
      ? task.deadline instanceof Date
        ? task.deadline.toISOString()
        : new Date(task.deadline).toISOString()
      : null,
    priority: task.priority,
    status: (task.status as string) || (task.isCompleted ? "done" : "todo"),
    is_completed: Boolean(task.isCompleted),
    completed_at: task.completedAt
      ? task.completedAt instanceof Date
        ? task.completedAt.toISOString()
        : new Date(task.completedAt).toISOString()
      : null,
    created_at: task.createdAt
      ? task.createdAt instanceof Date
        ? task.createdAt.toISOString()
        : new Date(task.createdAt).toISOString()
      : new Date().toISOString(),
    project:
      task.project && typeof task.project === "object" && task.project.title
        ? { id: task.project._id.toString(), title: task.project.title }
        : null,
    assignee:
      task.assignedDeveloper &&
      typeof task.assignedDeveloper === "object" &&
      task.assignedDeveloper.name
        ? { id: task.assignedDeveloper._id.toString(), name: task.assignedDeveloper.name }
        : null,
  };
}
