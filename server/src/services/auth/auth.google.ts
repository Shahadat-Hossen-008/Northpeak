// Google sign-in: verifies a Google ID token and signs in, links, or creates the matching User.
// Called through auth/auth.service.ts. Does not handle email or password sign-in.

import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { PendingRegistration } from "../../models/PendingRegistration.js";
import { User, type AppRole } from "../../models/User.js";
import { Activity } from "../../models/Activity.js";
import { AppError } from "../../middleware/error.js";
import { createSession, type AuthResult } from "./auth.utils.js";

const googleClient = new OAuth2Client();

/**
 * Signs in with a Google credential. Public: any caller with a valid Google ID token.
 * Side effects: links an unlinked User with the same email (clearing passwordHash if
 * emailVerified was false) and deletes any PendingRegistration; or for a new Google user,
 * creates a User (emailVerified true), one Activity "joined Northpeak as ...", and deletes
 * any PendingRegistration for that email.
 * Errors: 503 "Google sign-in is not configured", 400 "Google credential is required",
 * 401 "Google sign-in could not be verified",
 * 401 "Google sign-in requires a verified email address",
 * 409 "An account already uses this email. Sign in with your password first."
 */
export async function googleSignIn(input: {
  credential?: unknown;
  role?: unknown;
}): Promise<AuthResult> {
  // 1. Validate input
  const payload = await verifyGoogleToken(input.credential);

  // 2. Load what it needs
  const existingByGoogle = await User.findOne({ googleId: payload.sub }).select("+googleId");
  if (existingByGoogle) {
    return createSession(existingByGoogle);
  }

  const email = payload.email.toLowerCase().trim();
  const existingByEmail = await User.findOne({ email });

  // 4. Apply the rule or change
  if (existingByEmail) {
    return linkExistingUser(existingByEmail, payload.sub, email);
  }

  const role: AppRole = input.role === "manager" ? "manager" : "developer";
  const user = await User.create({
    name: payload.name?.trim() || email.split("@")[0],
    email,
    googleId: payload.sub,
    emailVerified: true,
    role,
  });

  // 5. Side effects (activity, notifications)
  await Activity.create({ actor: user._id, message: `joined Northpeak as ${user.role}` });
  await PendingRegistration.deleteOne({ email });

  // 6. Return the serialized result
  return createSession(user);
}

/** Verifies the Google ID token and returns a payload with a verified email and subject. */
async function verifyGoogleToken(
  credential: unknown,
): Promise<TokenPayload & { sub: string; email: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new AppError("Google sign-in is not configured", 503);
  if (typeof credential !== "string" || !credential)
    throw new AppError("Google credential is required", 400);
  let payload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("Google sign-in could not be verified", 401);
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError("Google sign-in requires a verified email address", 401);
  }
  return payload as TokenPayload & { sub: string; email: string };
}

/** Atomically links an existing unlinked User to the Google subject and clears any pending registration. */
async function linkExistingUser(
  existing: InstanceType<typeof User>,
  googleId: string,
  email: string,
): Promise<AuthResult> {
  const update =
    existing.emailVerified === false
      ? {
          $set: { googleId, emailVerified: true },
          $unset: { passwordHash: 1 as const },
        }
      : { $set: { googleId, emailVerified: true } };

  const linked = await User.findOneAndUpdate(
    { _id: existing._id, googleId: { $exists: false } },
    update,
    { new: true },
  );
  if (!linked) {
    throw new AppError(
      "An account already uses this email. Sign in with your password first.",
      409,
    );
  }

  await PendingRegistration.deleteOne({ email });
  return createSession(linked);
}
