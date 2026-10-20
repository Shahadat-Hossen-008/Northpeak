import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { User, type AppRole } from "../models/User.js";
import { EmailVerification } from "../models/EmailVerification.js";
import { Activity } from "../models/Activity.js";
import { generateToken } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { config } from "../config/env.js";
import { assertEmailDeliveryConfigured, sendVerificationCode } from "./email.service.js";
import {
  serializeAuthUser,
  serializeUserProfile,
  type SerializedAuthUser,
  type SerializedUserProfile,
} from "../serializers/user.serializer.js";

export interface RegisterInput {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

export interface LoginInput {
  email?: any;
  password?: any;
}

export interface UpdateProfileInput {
  name?: string;
  password?: any;
}

export interface AuthResult {
  token: string;
  user: SerializedAuthUser;
}

export interface RegisterResult {
  requiresEmailVerification: true;
  email: string;
}

const googleClient = new OAuth2Client();
const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function hashVerificationCode(code: string) {
  return crypto.createHmac("sha256", config.JWT_SECRET).update(code).digest("hex");
}

function createSession(user: InstanceType<typeof User>): AuthResult {
  return {
    token: generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    }),
    user: serializeAuthUser(user),
  };
}

async function createAndSendVerification(user: InstanceType<typeof User>) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await EmailVerification.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      codeHash: hashVerificationCode(code),
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_MS),
      attempts: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  try {
    await sendVerificationCode(user.email, user.name, code);
  } catch (error) {
    await EmailVerification.deleteOne({ userId: user._id });
    throw error;
  }
}

export class AuthService {
  async register(input: RegisterInput): Promise<RegisterResult> {
    assertEmailDeliveryConfigured();
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

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw new AppError("Email is already registered", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Honor the selected workspace role while keeping developer as the default.
    const userRole: AppRole = input.role === "manager" ? "manager" : "developer";

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
      emailVerified: false,
    });

    // Side effect: Record registration activity
    await Activity.create({
      actor: user._id,
      message: `joined Northpeak as ${user.role}`,
    });

    await createAndSendVerification(user);
    return { requiresEmailVerification: true, email: user.email };
  }

  async login(input: LoginInput): Promise<AuthResult> {
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

  async verifyEmail(input: { email?: unknown; code?: unknown }): Promise<AuthResult> {
    if (
      typeof input.email !== "string" ||
      typeof input.code !== "string" ||
      !/^\d{6}$/.test(input.code)
    ) {
      throw new AppError("Enter the six-digit verification code", 400);
    }
    const user = await User.findOne({ email: input.email.toLowerCase().trim() });
    if (!user || user.emailVerified !== false)
      throw new AppError("This verification code is invalid or expired", 400);
    const challenge = await EmailVerification.findOne({ userId: user._id }).select("+codeHash");
    if (
      !challenge ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.attempts >= MAX_CODE_ATTEMPTS
    ) {
      throw new AppError("This verification code is invalid or expired", 400);
    }
    const submitted = Buffer.from(hashVerificationCode(input.code), "hex");
    const saved = Buffer.from(challenge.codeHash, "hex");
    if (submitted.length !== saved.length || !crypto.timingSafeEqual(submitted, saved)) {
      await EmailVerification.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
      throw new AppError("This verification code is invalid or expired", 400);
    }
    const consumed = await EmailVerification.findOneAndDelete({
      _id: challenge._id,
      codeHash: challenge.codeHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_CODE_ATTEMPTS },
    });
    if (!consumed) throw new AppError("This verification code is invalid or expired", 400);
    user.emailVerified = true;
    await user.save();
    return createSession(user);
  }

  async resendVerification(input: { email?: unknown }): Promise<{ message: string }> {
    const generic = { message: "If this account needs verification, a code has been sent." };
    if (typeof input.email !== "string" || !input.email.trim()) return generic;
    const user = await User.findOne({ email: input.email.toLowerCase().trim() });
    if (!user || user.emailVerified !== false) return generic;
    const challenge = await EmailVerification.findOne({ userId: user._id });
    if (challenge && challenge.resendAvailableAt.getTime() > Date.now()) {
      throw new AppError("Please wait before requesting another code", 429);
    }
    await createAndSendVerification(user);
    return generic;
  }

  async googleSignIn(input: { credential?: unknown; role?: unknown }): Promise<AuthResult> {
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

  async getProfile(userId: string): Promise<SerializedUserProfile> {
    const user = await User.findById(userId).select("name email role emailVerified createdAt");
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return serializeUserProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<SerializedAuthUser> {
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
}

export const authService = new AuthService();
