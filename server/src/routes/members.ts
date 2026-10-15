import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { memberService } from "../services/member.service.js";

export const membersRouter = Router();

// Get members (optionally filtered by projectId for assignment, or all workspace members)
membersRouter.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const rawProjectId = (req.query.projectId ?? req.query.project_id) as string | undefined;
    const members = await memberService.getMembers(rawProjectId);
    res.json(members);
  }),
);

// Get single member profile
membersRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const member = await memberService.getMemberById(rawId);
    res.json(member);
  }),
);

// Get member workload and assigned tasks breakdown
membersRouter.get(
  "/:id/workload",
  authenticate,
  asyncHandler(async (req, res) => {
    const rawId = Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? "");
    const rawProjectId = (req.query.projectId ?? req.query.project_id) as string | undefined;
    const workload = await memberService.getMemberWorkload(rawId, rawProjectId);
    res.json(workload);
  }),
);
