// Google sign-in: verifies a Google ID token and signs in or creates the matching User.
// Called through auth/auth.service.ts. Does not handle email or password sign-in.

import { OAuth2Client } from "google-auth-library";
import { User, type AppRole } from "../../models/User.js";
import { Activity } from "../../models/Activity.js";
import { AppError } from "../../middleware/error.js";
import { createSession, type AuthResult } from "./auth.utils.js";

const googleClient = new OAuth2Client();

/**
 * Signs in with a Google credential. Public: any caller with a valid Google ID token.
 * Side effects: for a new Google user, creates a User (emailVerified true) and one Activity
 * "joined Northpeak as ...".
 * Errors: 503 "Google sign-in is not configured", 400 "Google credential is required",
 * 401 "Google sign-in could not be verified",
 * 401 "Google sign-in requires a verified email address",
 * 409 "An account already uses this email. Sign in with your password first."
 */
export async function googleSignIn(input: {
  credential?: unknown;
  role?: unknown;
}): Promise<AuthResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new AppError("Google sign-in is not configured", 503);
  if (typeof input.credential !== "string" || !input.credential)
    throw new AppError("Google credential is required", 400);
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: input.credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError("Google sign-in could not be verified", 401);
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError("Google sign-in requires a verified email address", 401);
  }
  let user = await User.findOne({ googleId: payload.sub }).select("+googleId");
  if (!user) {
    const email = payload.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing)
      throw new AppError(
        "An account already uses this email. Sign in with your password first.",
        409,
      );
    const role: AppRole = input.role === "manager" ? "manager" : "developer";
    user = await User.create({
      name: payload.name?.trim() || email.split("@")[0],
      email,
      googleId: payload.sub,
      emailVerified: true,
      role,
    });
    await Activity.create({ actor: user._id, message: `joined Northpeak as ${user.role}` });
  }
  return createSession(user);
}
