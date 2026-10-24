// Login: checks email and password and returns a session.
// Called through auth/auth.service.ts. Does not create accounts or send email.

import bcrypt from "bcryptjs";
import { User } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import { createSession, type AuthResult, type LoginInput } from "./auth.utils.js";

/**
 * Signs in with email and password. Public: any caller.
 * Side effects: none.
 * Errors: 400 "Email and password are required" or "Email and password must be strings",
 * 401 "Invalid email or password", 403 "Verify your email before signing in".
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError("Email and password must be strings", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.emailVerified === false) {
    throw new AppError("Verify your email before signing in", 403);
  }

  return createSession(user);
}
