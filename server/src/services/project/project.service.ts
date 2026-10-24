// Public project service API with operations grouped in focused modules.
// Called by routes/projects.ts; projectService retains the previous value export.
// This facade owns no database queries or request/response handling.

import { createProject } from "./project.create.js";
import { deleteProject } from "./project.delete.js";
import { getProjectByIdOrSlug, getProjectDetails, getProjectMembers, getProjects } from "./project.read.js";
import { updateProject } from "./project.update.js";
import { validateTeamDeveloperIds } from "./project.team.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import type { IProject } from "../../models/Project.js";
import type { SerializedProject, SerializedProjectMember } from "../../serializers/project.serializer.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.shared.js";

export {
  createProject,
  deleteProject,
  getProjectByIdOrSlug,
  getProjectDetails,
  getProjectMembers,
  getProjects,
  updateProject,
  validateTeamDeveloperIds,
};
export type { CreateProjectInput, UpdateProjectInput } from "./project.shared.js";

export interface ProjectService {
  validateTeamDeveloperIds(team: any): ReturnType<typeof validateTeamDeveloperIds>;
  getProjects(user: AuthUserPayload, query: { search?: any; priority?: any }): Promise<SerializedProject[]>;
  getProjectByIdOrSlug(idOrSlug: string): Promise<IProject>;
  getProjectDetails(idOrSlug: string, user: AuthUserPayload): Promise<SerializedProject>;
  getProjectMembers(idOrSlug: string, user: AuthUserPayload): Promise<SerializedProjectMember[]>;
  createProject(managerId: string, input: CreateProjectInput): Promise<SerializedProject>;
  updateProject(projectId: string, user: AuthUserPayload, input: UpdateProjectInput): Promise<SerializedProject>;
  deleteProject(projectId: string, user: AuthUserPayload): Promise<{ success: boolean; message: string }>;
}

export const projectService: ProjectService = {
  validateTeamDeveloperIds,
  getProjects,
  getProjectByIdOrSlug,
  getProjectDetails,
  getProjectMembers,
  createProject,
  updateProject,
  deleteProject,
};
