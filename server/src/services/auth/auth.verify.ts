// Email verification: checks the code and, only if it is right, creates the real User.
// Called through auth/auth.service.ts.

import crypto from "node:crypto";
import mongoose from "mongoose";
import { PendingRegistration } from "../../models/PendingRegistration.js";
import { User } from "../../models/User.js";
import { Activity } from "../../models/Activity.js";
import { AppError } from "../../middleware/error.js";
import {
  hashVerificationCode,
  createSession,
  MAX_CODE_ATTEMPTS,
  type AuthResult,
  type VerifyInput,
} from "./auth.utils.js";

const INVALID_CODE = "This verification code is invalid or expired";

/**
 * Verifies the six-digit code and creates the User with emailVerified true.
 * Side effects: counts the attempt, then deletes the PendingRegistration, creates the User and
 * one Activity "joined Northpeak as ..." in one transaction.
 * Errors: 400 for a malformed code or an invalid, expired or exhausted code.
 */
export async function verifyEmail(input: VerifyInput): Promise<AuthResult> {
  // 1. Validate input
  if (
    typeof input.email !== "string" ||
    typeof input.code !== "string" ||
    !/^\d{6}$/.test(input.code)
  ) {
    throw new AppError("Enter the six-digit verification code", 400);
  }
  const normalizedEmail = input.email.toLowerCase().trim();

  // 2. Count this attempt first, in one atomic step, so parallel guesses can never go past the limit
  const pending = await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_CODE_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).select("+codeHash");
  if (!pending) {
    throw new AppError(INVALID_CODE, 400);
  }

  // 3. Check the code in constant time
  const submitted = Buffer.from(hashVerificationCode(normalizedEmail, input.code), "hex");
  const saved = Buffer.from(pending.codeHash, "hex");
  if (submitted.length !== saved.length || !crypto.timingSafeEqual(submitted, saved)) {
    throw new AppError(INVALID_CODE, 400);
  }

  // 4. Claim the registration and create the account in one transaction. If creating the
  // User fails, the delete rolls back and the person can try again. If two requests race,
  // one gets a write conflict, is retried, finds nothing to claim and returns 400.
  const user = await mongoose.connection.transaction(async (session) => {
    const claimed = await PendingRegistration.findOneAndDelete(
      { _id: pending._id, codeHash: pending.codeHash },
      { session },
    ).select("+passwordHash");
    if (!claimed) {
      throw new AppError(INVALID_CODE, 400);
    }

    const [created] = await User.create(
      [
        {
          name: claimed.name,
          email: claimed.email,
          passwordHash: claimed.passwordHash,
          role: claimed.role,
          emailVerified: true,
        },
      ],
      { session },
    );
    await Activity.create([{ actor: created._id, message: `joined Northpeak as ${created.role}` }], {
      session,
    });
    return created;
  });

  // 5. Return the session
  return createSession(user);
}
