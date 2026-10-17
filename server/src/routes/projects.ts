import { Router } from "express";
import { authenticate, requireRole, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { projectService } from "../services/project.service.js";

export const projectsRouter = Router();

// Get all projects (with optional search and priority filtering)
projectsRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const projects = await projectService.getProjects(req.query);
    res.json(projects);
  }),
);

// Get single project by ID or Slug
projectsRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const project = await projectService.getProjectDetails(rawId);
    res.json(project);
  }),
);

// Get eligible engineering team members for a project
projectsRouter.get(
  "/:id/members",
  authenticate,
  asyncHandler(async (req, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const members = await projectService.getProjectMembers(rawId);
    res.json(members);
  }),
);

// Create project (Manager only)
projectsRouter.post(
  "/",
  authenticate,
  requireRole("manager"),
  asyncHandler(async (req: AuthRequest, res) => {
    const project = await projectService.createProject(req.user!.id, req.body);
    res.status(201).json(project);
  }),
);

// Update project (Manager only)
projectsRouter.patch(
  "/:id",
  authenticate,
  requireRole("manager"),
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const updated = await projectService.updateProject(rawId, req.user!, req.body);
    res.json(updated);
  }),
);

// Delete project (Manager only) — Cascades to tasks, subtasks, comments, activities
projectsRouter.delete(
  "/:id",
  authenticate,
  requireRole("manager"),
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const result = await projectService.deleteProject(rawId, req.user!);
    res.json(result);
  }),
);
