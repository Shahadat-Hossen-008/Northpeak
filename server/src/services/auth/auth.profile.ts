// Profile: reads and updates the signed-in user's own profile.
// Called through auth/auth.service.ts. Does not handle sign-in or verification.

import bcrypt from "bcryptjs";
import { User } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import {
  serializeAuthUser,
  serializeUserProfile,
  type SerializedAuthUser,
  type SerializedUserProfile,
} from "../../serializers/user.serializer.js";
import type { UpdateProfileInput } from "./auth.utils.js";

/**
 * Returns the profile of one user. Callable by any signed-in user for their own id.
 * Side effects: none. Errors: 404 "User not found".
 */
export async function getProfile(userId: string): Promise<SerializedUserProfile> {
  const user = await User.findById(userId).select("name email role emailVerified createdAt");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return serializeUserProfile(user);
}

/**
 * Updates the name and/or password of one user. Callable by a signed-in user for their own id.
 * Side effects: saves the User; a new password is stored as a bcrypt hash.
 * Errors: 404 "User not found", 400 "Password must be at least 6 characters".
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<SerializedAuthUser> {
  const { name, password } = input;
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (name && name.trim().length >= 2) {
    user.name = name.trim();
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
  }

  await user.save();
  return serializeAuthUser(user);
}
