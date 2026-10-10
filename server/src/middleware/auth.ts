import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type AppRole } from "../models/User.js";

export interface AuthUserPayload {
  id: string;
  email: string;
  role: AppRole;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || "northpeak_super_secret_jwt_key_2026";

export function generateToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    // Verify user still exists in DB
    const user = await User.findById(decoded.id).select("name email role");
    if (!user) {
      res.status(401).json({ message: "User account no longer exists" });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(role: AppRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ message: `Access forbidden: requires ${role} role` });
      return;
    }

    next();
  };
}
