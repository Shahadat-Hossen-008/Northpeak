// Project creation and its activity and manager-audience notification side effects.
// Called by the Project service facade for manager-only project routes.
// This module does not handle request or response objects.

import mongoose from "mongoose";
import { Activity } from "../../models/Activity.js";
import { Notification } from "../../models/Notification.js";
import { Project } from "../../models/Project.js";
import { AppError } from "../../middleware/error.js";
import {
  serializeProject,
  type SerializedProject,
} from "../../serializers/project.serializer.js";
import { validateTeamDeveloperIds } from "./project.team.js";
import type { CreateProjectInput } from "./project.shared.js";

/**
 * Creates a project, then records activity and a manager-audience notification.
 * Who may call it: authenticated project managers. Side effects: project, activity, notification writes.
 * Errors: 400 ("Project title must be at least 3 characters", "Team must be an array of developer IDs",
 * "Invalid developer ID: <id>", "All team members must be registered developers", or fallback
 * "Invalid team developer IDs" if a failed validation has no error message).
 */
export async function createProject(
  managerId: string,
  input: CreateProjectInput,
): Promise<SerializedProject> {
  // 1. Validate the title and optional team.
  const { title, description, start_date, deadline, priority, team } = input;
  if (!title || title.trim().length < 3) {
    throw new AppError("Project title must be at least 3 characters", 400);
  }
  let teamIds: mongoose.Types.ObjectId[] = [];
  if (team !== undefined) {
    const validation = await validateTeamDeveloperIds(team);
    if (!validation.valid) throw new AppError(validation.error || "Invalid team developer IDs", 400);
    teamIds = validation.devIds;
  }
  // 2. Create the project with the validated values.
  const project = await Project.create({
    title: title.trim(),
    description: (description || "").trim(),
    manager: managerId,
    team: teamIds,
    startDate: start_date ? new Date(start_date) : null,
    deadline: deadline ? new Date(deadline) : null,
    priority: priority || "medium",
  });
  // 3. Record activity before the manager notification.
  await Activity.create({
    project: project._id,
    actor: managerId,
    message: `created project ${project.title}`,
  });
  await Notification.create({
    audience: "manager",
    kind: "project_created",
    title: "Project created",
    body: `${project.title} was created.`,
    project: project._id,
  });
  // 4. Return the serialized project.
  return serializeProject(project);
}
