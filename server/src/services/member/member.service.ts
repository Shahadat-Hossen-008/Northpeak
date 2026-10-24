// Member service façade for read-only directory and profile lookups.
// Called by routes/members.ts; workload details live in member/member.workload.ts.
// Must not write data, trigger side effects, or touch req/res.

import { isValidObjectId } from "mongoose";
import { User } from "../../models/User.js";
import { Project, type IProject } from "../../models/Project.js";
import { AppError } from "../../middleware/error.js";
import { getProjectEligibleDevelopers } from "../team.js";
import { serializeMember, type SerializedMember } from "../../serializers/member.serializer.js";
import { slugify } from "../../lib/utils.js";

/**
 * Returns a member's workload through the existing member service API.
 * Who may call it: any authenticated user. Side effects: none.
 * Errors: 400 ("Invalid member ID") for an invalid ID; 404 ("Member not found") when absent.
 */
export { getMemberWorkload } from "./member.workload.js";

/**
 * Returns workspace members or eligible developers for a project.
 * Who may call it: any authenticated user. Side effects: none.
 * Errors: 404 ("Project not found") when no project matches the supplied ID, slug, or title.
 */
export async function getMembers(rawProjectId?: string): Promise<SerializedMember[]> {
  if (rawProjectId !== undefined) {
    const project = await findProject(rawProjectId);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const eligibleDevs = await getProjectEligibleDevelopers(project._id);
    return eligibleDevs.map(serializeMember);
  }

  const users = await User.find().select("name email role createdAt").sort({ name: 1 });
  return users.map(serializeMember);
}

/** Looks up a project by ObjectId first, then falls back to slug or case-insensitive title match. */
async function findProject(rawProjectId: string): Promise<IProject | null> {
  let project = null;
  if (isValidObjectId(rawProjectId)) {
    project = await Project.findById(rawProjectId);
  }

  // Fall back to slug or case-insensitive title match when rawProjectId is not a matching ObjectId
  if (!project) {
    const target = rawProjectId.toLowerCase().trim();
    // Loads only _id and title of every project to compare slugs
    const allProjects = await Project.find({}, "_id title");
    const match = allProjects.find((p) => {
      const slug = slugify(p.title);
      return slug === target || p.title.toLowerCase() === target;
    });

    if (match) {
      project = await Project.findById(match._id);
    }
  }

  return project;
}

/**
 * Returns one member profile by user ID.
 * Who may call it: any authenticated user. Side effects: none.
 * Errors: 400 ("Invalid member ID") for an invalid ID; 404 ("Member not found") when absent.
 */
export async function getMemberById(id: string): Promise<SerializedMember> {
  if (!isValidObjectId(id)) {
    throw new AppError("Invalid member ID", 400);
  }

  const user = await User.findById(id).select("name email role createdAt");
  if (!user) {
    throw new AppError("Member not found", 404);
  }

  return serializeMember(user);
}
