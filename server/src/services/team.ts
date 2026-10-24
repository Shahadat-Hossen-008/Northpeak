// Shared project-team membership queries used by cross-domain services.
// Callers retain their own authorization and write responsibilities.
// Concurrency test barriers are re-exported from their dedicated shared module.

import mongoose, { isValidObjectId } from "mongoose";
import { Project } from "../models/Project.js";
import { User, type IUser } from "../models/User.js";

/**
 * Returns the IDs of all developers who belong to a project's engineering team.
 *
 * Explicit project-team membership stored in `project.team` is the authoritative source of truth:
 * - Does not infer membership from tasks.
 * - Developers on the team are eligible even if they currently have 0 tasks assigned.
 * - Legacy or empty teams return [] safely without inventing memberships.
 * - Verified against the User model to ensure role === "developer".
 * Who may call it: project-team membership helpers. Side effects: database reads only.
 * Errors: database errors propagate; invalid or missing projects return an empty list.
 */
export async function getProjectEngineeringTeamIds(
  projectId: string | mongoose.Types.ObjectId,
): Promise<string[]> {
  if (!isValidObjectId(projectId)) {
    return [];
  }

  const project = await Project.findById(projectId).select("team");
  if (!project || !Array.isArray(project.team) || project.team.length === 0) {
    return [];
  }

  const explicitTeam = project.team.filter(Boolean).map((id) => id.toString());
  if (explicitTeam.length === 0) {
    return [];
  }

  // Verify that these users exist and have developer role
  const validDevs = await User.find({
    _id: { $in: explicitTeam },
    role: "developer",
  }).select("_id");

  return validDevs.map((d) => d._id.toString());
}

/**
 * Checks whether a specific developer belongs to a project's engineering team.
 * Who may call it: assignment validation workflows. Side effects: database reads only.
 * Errors: database errors propagate; invalid IDs return false.
 */
export async function isDeveloperInProjectTeam(
  projectId: string | mongoose.Types.ObjectId,
  developerId: string | mongoose.Types.ObjectId,
): Promise<boolean> {
  if (!isValidObjectId(projectId) || !isValidObjectId(developerId)) {
    return false;
  }

  const teamIds = await getProjectEngineeringTeamIds(projectId);
  return teamIds.includes(developerId.toString());
}

/**
 * Retrieves full developer User documents belonging to a project's engineering team.
 * Who may call it: project and member read workflows. Side effects: database reads only.
 * Errors: database errors propagate; invalid or empty teams return an empty list.
 */
export async function getProjectEligibleDevelopers(
  projectId: string | mongoose.Types.ObjectId,
): Promise<IUser[]> {
  const teamIds = await getProjectEngineeringTeamIds(projectId);
  if (teamIds.length === 0) {
    return [];
  }

  return User.find({
    _id: { $in: teamIds },
    role: "developer",
  })
    .select("name email role createdAt")
    .sort({ name: 1 });
}

export { concurrencyTestBarriers } from "./team.barriers.js";
