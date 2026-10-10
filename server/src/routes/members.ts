import { Router } from "express";
import { User } from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

export const membersRouter = Router();

// Get all members (for assignment, team view, etc.)
membersRouter.get("/", authenticate, async (_req, res) => {
  try {
    const users = await User.find().select("name email role createdAt").sort({ name: 1 });
    const formatted = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});
