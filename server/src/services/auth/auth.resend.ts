// Resend: issues a new code for a pending registration, up to 5 sends per 15-minute window.
// Called through auth/auth.service.ts.

import { PendingRegistration } from "../../models/PendingRegistration.js";
import { sendVerificationCode } from "../email.service.js";
import {
  MAX_CODE_SENDS,
  newVerificationChallenge,
  tooManySendsError,
} from "./auth.utils.js";

/**
 * Sends a new code if a registration for this email is pending and under the send limit.
 * Side effects: replaces the code and resets the attempts, increments sendCount, then sends one email.
 * Errors: 429 if 5 codes have been sent in the current 15-minute window.
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
    { email: normalizedEmail, expiresAt: { $gt: now }, sendCount: { $lt: MAX_CODE_SENDS } },
    {
      $set: {
        codeHash: challenge.codeHash,
        codeExpiresAt: challenge.codeExpiresAt,
        attempts: 0,
      },
      $inc: { sendCount: 1 },
    },
    { new: false },
  ).select("+codeHash");

  // 2. Nothing changed: the limit was reached, or nothing is pending
  if (!previous) {
    const waiting = await PendingRegistration.findOne({
      email: normalizedEmail,
      expiresAt: { $gt: now },
    }).select("expiresAt");
    if (waiting) {
      throw tooManySendsError(waiting.expiresAt, now);
    }
    return generic;
  }

  // 3. Send the email. On failure revert the counter and challenge so a retry works.
  try {
    await sendVerificationCode(previous.email, previous.name, challenge.code);
  } catch (err) {
    await PendingRegistration.updateOne(
      { _id: previous._id, codeHash: challenge.codeHash },
      {
        $set: {
          codeHash: previous.codeHash,
          codeExpiresAt: previous.codeExpiresAt,
          attempts: previous.attempts,
        },
        $inc: { sendCount: -1 },
      },
    );
    throw err;
  }

  return generic;
}
