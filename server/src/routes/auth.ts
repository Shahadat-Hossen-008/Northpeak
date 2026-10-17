import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { authService } from "../services/auth.service.js";

export const authRouter = Router();

// Register new user
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),
);

// Login
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),
);

// Get current session user
authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await authService.getProfile(req.user!.id);
    res.json(result);
  }),
);

// Update profile / password
authRouter.patch(
  "/profile",
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await authService.updateProfile(req.user!.id, req.body);
    res.json(result);
  }),
);
