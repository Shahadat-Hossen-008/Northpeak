// Registration: saves the sign-up as a PendingRegistration and emails a six-digit code.
// No User exists until verifyEmail succeeds. Called through auth/auth.service.ts.

import bcrypt from "bcryptjs";
import { PendingRegistration } from "../../models/PendingRegistration.js";
import { User, type AppRole } from "../../models/User.js";
import { AppError } from "../../middleware/error.js";
import { sendVerificationCode, assertEmailDeliveryConfigured } from "../email.service.js";
import { newVerificationChallenge } from "./auth.utils.js";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Starts a registration. Returns { requiresEmailVerification: true, email }.
 * Side effects: saves or replaces a PendingRegistration and sends one email. Creates no User
 * and no Activity.
 * Errors: 400 invalid input or "Email is already registered";
 * 429 "Please wait before requesting another code" if a sign-up for this email was made less
 * than 60 seconds ago.
 */
export async function register(input: {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}): Promise<{ requiresEmailVerification: true; email: string }> {
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
  // The client-supplied role is still honored (pending product decision, test AUTH-REG)
  const role: AppRole = input.role === "manager" ? "manager" : "developer";
  const challenge = newVerificationChallenge(normalizedEmail);

  // A new sign-up replaces the stored name, password, role and code, so an earlier sign-up
  // for this address by someone else can never be verified by its owner. The cooldown filter
  // stops repeated sign-ups from flooding the inbox: if the cooldown has not passed, nothing
  // matches, the upsert tries to insert, and the unique email index raises a duplicate error.
  try {
    await PendingRegistration.updateOne(
      { email: normalizedEmail, resendAvailableAt: { $lte: new Date() } },
      {
        $set: {
          name: name.trim(),
          passwordHash,
          role,
          codeHash: challenge.codeHash,
          expiresAt: challenge.expiresAt,
          resendAvailableAt: challenge.resendAvailableAt,
          attempts: 0,
        },
      },
      { upsert: true },
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError("Please wait before requesting another code", 429);
    }
    throw err;
  }

  // 4. Side effect: send the email. On failure remove only the record this request wrote.
  try {
    await sendVerificationCode(normalizedEmail, name.trim(), challenge.code);
  } catch (err) {
    await PendingRegistration.deleteOne({ email: normalizedEmail, codeHash: challenge.codeHash });
    throw err;
  }

  // 5. Return the result
  return { requiresEmailVerification: true, email: normalizedEmail };
}
