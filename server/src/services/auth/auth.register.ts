// Registration: saves the sign-up as a PendingRegistration and emails a six-digit code.
// No User exists until verifyEmail succeeds. Called through auth/auth.service.ts.

import bcrypt from "bcryptjs";
import { PendingRegistration } from "../../models/PendingRegistration.js";
import { User, type AppRole } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import { sendVerificationCode, assertEmailDeliveryConfigured } from "../email.service.js";
import {
  CODE_TTL_MS,
  SEND_WINDOW_MS,
  MAX_CODE_SENDS,
  newVerificationChallenge,
  tooManySendsError,
  type RegisterInput,
  type RegisterResult,
} from "./auth.utils.js";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

interface PendingFields {
  name: string;
  passwordHash: string;
  role: AppRole;
  codeHash: string;
  codeExpiresAt: Date;
}

async function savePending(email: string, fields: PendingFields): Promise<void> {
  for (let round = 0; round < 3; round++) {
    const now = new Date();
    try {
      await PendingRegistration.create({
        email,
        ...fields,
        attempts: 0,
        sendCount: 1,
        expiresAt: new Date(now.getTime() + SEND_WINDOW_MS),
      });
      return;
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }
      const updated = await PendingRegistration.findOneAndUpdate(
        { email, expiresAt: { $gt: now }, sendCount: { $lt: MAX_CODE_SENDS } },
        {
          $set: { ...fields, attempts: 0 },
          $inc: { sendCount: 1 },
        },
      );
      if (updated) {
        return;
      }
      const blocked = await PendingRegistration.findOne({ email, expiresAt: { $gt: now } });
      if (blocked) {
        throw tooManySendsError(blocked.expiresAt, now);
      }
      await PendingRegistration.deleteOne({ email, expiresAt: { $lte: now } });
    }
  }
  throw new AppError("Could not start registration. Please try again.", 500);
}

/**
 * Starts a registration. Returns { requiresEmailVerification: true, email, codeExpiresInSeconds }.
 * Side effects: saves or replaces a PendingRegistration and sends one email. Creates no User
 * and no Activity.
 * Errors: 400 invalid input or "Email is already registered";
 * 429 "Too many code requests for this email. Try again in X minutes." if 5 codes were sent
 * within the 15-minute window.
 */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  // 1. Validate input
  const { name, email, password } = input;
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }
  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    throw new AppError("Name, email, and password must be strings", 400);
  }
  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  // 2. Load what it needs: an existing account blocks registration
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.findOne({ email: normalizedEmail })) {
    throw new AppError("Email is already registered", 400);
  }
  assertEmailDeliveryConfigured();

  // 3. Apply the change: hash the password and build the code
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
  const role: AppRole = input.role === "manager" ? "manager" : "developer";
  const challenge = newVerificationChallenge(normalizedEmail);

  await savePending(normalizedEmail, {
    name: name.trim(),
    passwordHash,
    role,
    codeHash: challenge.codeHash,
    codeExpiresAt: challenge.codeExpiresAt,
  });

  // 4. Side effect: send the email. On failure remove only the record this request wrote.
  try {
    await sendVerificationCode(normalizedEmail, name.trim(), challenge.code);
  } catch (err) {
    await PendingRegistration.deleteOne({ email: normalizedEmail, codeHash: challenge.codeHash });
    throw err;
  }

  // 5. Return the result
  return {
    requiresEmailVerification: true,
    email: normalizedEmail,
    codeExpiresInSeconds: CODE_TTL_MS / 1000,
  };
}
