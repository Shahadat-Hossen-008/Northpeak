// Shared helpers for the auth modules: verification-code rules and session creation.

import crypto from "node:crypto";
import { generateToken } from "../../middleware/auth.js";
import { config } from "../../config/env.js";
import { AppError } from "../../middleware/error.js";
import { serializeAuthUser, type SerializedAuthUser } from "../../serializers/user.serializer.js";
import type { User } from "../../models/User.js";

export const CODE_TTL_MS = 2 * 60 * 1000;
export const SEND_WINDOW_MS = 15 * 60 * 1000;
export const MAX_CODE_SENDS = 5;
export const MAX_CODE_ATTEMPTS = 5;

type UserDoc = InstanceType<typeof User>;

export interface LoginInput {
  email?: unknown;
  password?: unknown;
}

export interface VerifyInput {
  email?: unknown;
  code?: unknown;
}

export interface RegisterInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

export interface RegisterResult {
  requiresEmailVerification: true;
  email: string;
  codeExpiresInSeconds: number;
}

export interface UpdateProfileInput {
  name?: string;
  password?: unknown;
}

export interface AuthResult {
  token: string;
  user: SerializedAuthUser;
}

/** Builds an error with the remaining minutes until a new code may be requested. */
export function tooManySendsError(windowEndsAt: Date, now: Date): AppError {
  const minutes = Math.max(1, Math.ceil((windowEndsAt.getTime() - now.getTime()) / 60_000));
  return new AppError(
    `Too many code requests for this email. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    429,
  );
}

/** Hashes a code together with the email, so the same code gives a different hash per address. */
export function hashVerificationCode(email: string, code: string): string {
  return crypto
    .createHmac("sha256", config.JWT_SECRET)
    .update(`email-verification:${email}:${code}`)
    .digest("hex");
}

/** Makes a new six-digit code with its hash and expiry time. */
export function newVerificationChallenge(email: string) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = Date.now();
  return {
    code,
    codeHash: hashVerificationCode(email, code),
    codeExpiresAt: new Date(now + CODE_TTL_MS),
  };
}

/** Builds the JWT and the serialized user returned after a successful sign-in. */
export function createSession(user: UserDoc): AuthResult {
  const token = generateToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  });
  return { token, user: serializeAuthUser(user) };
}
