import { authApi } from "./auth";
import { membersApi } from "./members";
import { projectsApi } from "./projects";
import { tasksApi } from "./tasks";
import { subtasksApi } from "./subtasks";
import { commentsApi } from "./comments";
import { notificationsApi } from "./notifications";
import { activityApi } from "./activity";

export {
  getAuthToken,
  getAuthTokenRevision,
  setAuthToken,
  registerAuthHandlers,
  request,
  resolveApiBaseUrl,
  buildApiUrl,
  type ApiClientEnv,
} from "./client";
export { authApi } from "./auth";
export { membersApi } from "./members";
export { projectsApi } from "./projects";
export { tasksApi } from "./tasks";
export { subtasksApi } from "./subtasks";
export { commentsApi } from "./comments";
export { notificationsApi } from "./notifications";
export { activityApi } from "./activity";

export const api = {
  ...authApi,
  ...membersApi,
  ...projectsApi,
  ...tasksApi,
  ...subtasksApi,
  ...commentsApi,
  ...notificationsApi,
  ...activityApi,
};
