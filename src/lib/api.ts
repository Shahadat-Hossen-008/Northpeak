export type Priority = "low" | "medium" | "high" | "critical";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "manager" | "developer";
};

export type Member = {
  id: string;
  name: string;
  email: string | null;
  role: "manager" | "developer" | null;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  manager_id: string | null;
  start_date: string | null;
  deadline: string | null;
  priority: Priority;
  created_at: string;
};

export type Task = {
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
  project: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
  author: { id: string; name: string } | null;
};

export type ActivityItem = {
  id: string;
  message: string;
  created_at: string;
  project_id: string | null;
  task_id: string | null;
  actor: { id: string; name: string } | null;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  task_id: string | null;
  project_id: string | null;
};

const BASE_URL = "/api";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("northpeak_token");
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("northpeak_token", token);
  } else {
    localStorage.removeItem("northpeak_token");
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData?.message) errorMsg = errorData.message;
    } catch {
      // response is not json
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(credentials: { email: string; password: string }) {
    const data = await request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAuthToken(data.token);
    return data;
  },

  async register(payload: { name: string; email: string; password: string; role: string }) {
    const data = await request<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthToken(data.token);
    return data;
  },

  async getMe() {
    return request<AuthUser>("/auth/me");
  },

  async updateProfile(payload: { name?: string; password?: string }) {
    return request<AuthUser>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  logout() {
    setAuthToken(null);
  },

  // Members
  async getMembers() {
    return request<Member[]>("/members");
  },

  // Projects
  async getProjects() {
    return request<Project[]>("/projects");
  },

  async getProject(id: string) {
    return request<Project>(`/projects/${id}`);
  },

  async createProject(payload: {
    title: string;
    description: string;
    start_date: string | null;
    deadline: string | null;
    priority: string;
  }) {
    return request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateProject(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      start_date: string | null;
      deadline: string | null;
      priority: string;
    }>,
  ) {
    return request<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteProject(id: string) {
    return request<{ success: boolean; message: string }>(`/projects/${id}`, {
      method: "DELETE",
    });
  },

  // Tasks
  async getTasks() {
    return request<Task[]>("/tasks");
  },

  async getTask(id: string) {
    return request<Task>(`/tasks/${id}`);
  },

  async createTask(payload: {
    project_id: string;
    title: string;
    description: string;
    assigned_developer_id: string | null;
    deadline: string | null;
    priority: string;
  }) {
    return request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateTask(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      assigned_developer_id: string | null;
      deadline: string | null;
      priority: string;
      is_completed: boolean;
    }>,
  ) {
    return request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async setTaskCompletion(id: string, completed: boolean) {
    return request<Task>(`/tasks/${id}/complete`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
  },

  async deleteTask(id: string) {
    return request<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  },

  // Subtasks
  async getAllSubtasks() {
    return request<Subtask[]>("/subtasks");
  },

  async getSubtasks(taskId: string) {
    return request<Subtask[]>(`/subtasks/task/${taskId}`);
  },

  async createSubtask(taskId: string, title: string) {
    return request<Subtask>(`/subtasks/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },

  async updateSubtask(id: string, patch: { title?: string; is_completed?: boolean }) {
    return request<Subtask>(`/subtasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteSubtask(id: string) {
    return request<{ success: boolean; message: string }>(`/subtasks/${id}`, {
      method: "DELETE",
    });
  },

  // Comments
  async getComments(taskId: string) {
    return request<Comment[]>(`/comments/task/${taskId}`);
  },

  async getCommentCounts() {
    return request<Record<string, number>>("/comments/counts");
  },

  async addComment(taskId: string, body: string) {
    return request<Comment>(`/comments/task/${taskId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  },

  async deleteComment(id: string) {
    return request<{ success: boolean; message: string }>(`/comments/${id}`, {
      method: "DELETE",
    });
  },

  // Notifications
  async getNotifications() {
    return request<AppNotification[]>("/notifications");
  },

  async markNotifications(ids: string[]) {
    return request<{ success: boolean }>("/notifications/mark-read", {
      method: "PATCH",
      body: JSON.stringify({ ids }),
    });
  },

  // Activity
  async getActivity(filter?: { projectId?: string; taskId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filter?.projectId) params.append("projectId", filter.projectId);
    if (filter?.taskId) params.append("taskId", filter.taskId);
    if (filter?.limit) params.append("limit", filter.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<ActivityItem[]>(`/activity${query}`);
  },
};
