// Resend: issues a new code for a pending registration, at most once per cooldown.
// Called through auth/auth.service.ts.

import { AppError } from "../../middleware/error.js";
import { PendingRegistration } from "../../models/PendingRegistration.js";
import { sendVerificationCode } from "../email.service.js";
import { newVerificationChallenge } from "./auth.utils.js";

/**
 * Sends a new code if a registration for this email is pending and its cooldown has passed.
 * Side effects: replaces the code and resets the attempts, then sends one email.
 * Errors: 429 "Please wait before requesting another code" during the cooldown.
 * Any other case returns the same generic message, so the response does not reveal the account state.
 */
export async function resendVerification({
  email,
}: {
  email?: unknown;
}): Promise<{ message: string }> {
  const generic = { message: "If this account needs verification, a code has been sent." };
  if (typeof email !== "string" || !email.trim()) {
    return generic;
  }

  // 1. Load what it needs and replace the code in one atomic step
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const challenge = newVerificationChallenge(normalizedEmail);
  const previous = await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail, expiresAt: { $gt: now }, resendAvailableAt: { $lte: now } },
    {
      $set: {
        codeHash: challenge.codeHash,
        expiresAt: challenge.expiresAt,
        resendAvailableAt: challenge.resendAvailableAt,
        attempts: 0,
      },
    },
    { new: false },
  ).select("+codeHash");

  // 2. Nothing changed: the cooldown is running, or nothing is pending
  if (!previous) {
    const waiting = await PendingRegistration.exists({
      email: normalizedEmail,
      expiresAt: { $gt: now },
      resendAvailableAt: { $gt: now },
    });
    if (waiting) {
      throw new AppError("Please wait before requesting another code", 429);
    }
    return generic;
  }

  // 3. Send the email. On failure put the old code and cooldown back so a retry works at once.
  try {
    await sendVerificationCode(previous.email, previous.name, challenge.code);
  } catch (err) {
    await PendingRegistration.updateOne(
      { _id: previous._id, codeHash: challenge.codeHash },
      {
        $set: {
          codeHash: previous.codeHash,
          expiresAt: previous.expiresAt,
          resendAvailableAt: previous.resendAvailableAt,
          attempts: previous.attempts,
        },
      },
    );
    throw err;
  }

  return generic;
}
