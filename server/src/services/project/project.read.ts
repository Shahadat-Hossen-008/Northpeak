// Read-only project retrieval and listing.
// Called by the Project service facade for authenticated project routes.
// This module does not write data or trigger project side effects.

import { isValidObjectId } from "mongoose";
import { Project, type IProject } from "../../models/Project.js";
import { Task } from "../../models/Task.js";
import { AppError } from "../../middleware/error.js";
import type { AuthUserPayload } from "../../middleware/auth.js";
import { escapeRegex, slugify } from "../../lib/utils.js";
import { getProjectEligibleDevelopers } from "../team.js";
import { canReadProject } from "../task-access.js";
import {
  serializeProject,
  serializeProjectMember,
  type SerializedProject,
  type SerializedProjectMember,
} from "../../serializers/project.serializer.js";

/**
 * Lists projects visible to a manager or developer with the supported filters.
 * Who may call it: authenticated managers and developers. Side effects: none.
 * Errors: 403 ("Not authorized to read projects") for roles other than manager or developer.
 */
export async function getProjects(
  user: AuthUserPayload,
  query: { search?: any; priority?: any },
): Promise<SerializedProject[]> {
  const { search, priority } = query;
  let accessFilter: Record<string, any>;
  if (user.role === "manager") {
    accessFilter = { manager: user.id };
  } else if (user.role === "developer") {
    const assignedProjectIds = await Task.find({ assignedDeveloper: user.id }).distinct("project");
    accessFilter = { $or: [{ team: user.id }, { _id: { $in: assignedProjectIds } }] };
  } else {
    throw new AppError("Not authorized to read projects", 403);
  }

  const filter: Record<string, any> = { $and: [accessFilter] };
  if (priority && typeof priority === "string") filter.priority = priority;
  if (search && typeof search === "string" && search.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$and.push({
      $or: [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  const projects = await Project.find(filter).sort({ createdAt: -1 });
  return projects.map(serializeProject);
}

/**
 * Resolves a project by ObjectId, slug, or case-insensitive title.
 * Who may call it: Project service read workflows. Side effects: database reads only.
 * Errors: 404 ("Project not found") when no project matches or multiple projects share the title/slug.
 */
export async function getProjectByIdOrSlug(idOrSlug: string): Promise<IProject> {
  const rawId = idOrSlug.trim();
  let project: IProject | null = null;
  if (isValidObjectId(rawId)) project = await Project.findById(rawId);

  if (!project) {
    const target = rawId.toLowerCase();
    const allProjects = await Project.find({}, "_id title");
    const matches = allProjects.filter((candidate) => {
      const slug = slugify(candidate.title);
      return slug === target || candidate.title.toLowerCase() === target;
    });
    if (matches.length > 1) throw new AppError("Project not found", 404);
    if (matches.length === 1) project = await Project.findById(matches[0]._id);
  }

  if (!project) throw new AppError("Project not found", 404);
  return project;
}

/**
 * Returns one project after applying the existing role-aware read boundary.
 * Who may call it: authenticated project users. Side effects: database reads only.
 * Errors: 404 ("Project not found") when missing or inaccessible by the existing read boundary.
 */
export async function getProjectDetails(
  idOrSlug: string,
  user: AuthUserPayload,
): Promise<SerializedProject> {
  const project = await getProjectByIdOrSlug(idOrSlug);
  if (!(await canReadProject(project._id, user))) throw new AppError("Project not found", 404);
  return serializeProject(project);
}

/**
 * Returns eligible developers for a project after its existing membership check.
 * Who may call it: authenticated project managers and team developers. Side effects: database reads only.
 * Errors: 404 ("Project not found") when missing or the user is not the manager or a project-team developer.
 */
export async function getProjectMembers(
  idOrSlug: string,
  user: AuthUserPayload,
): Promise<SerializedProjectMember[]> {
  const project = await getProjectByIdOrSlug(idOrSlug);
  const allowed =
    user.role === "manager"
      ? project.manager.toString() === user.id
      : user.role === "developer" && project.team.some((member) => member.toString() === user.id);
  if (!allowed) throw new AppError("Project not found", 404);
  const eligibleDevs = await getProjectEligibleDevelopers(project._id);
  return eligibleDevs.map(serializeProjectMember);
}
