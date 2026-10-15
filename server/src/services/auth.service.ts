import bcrypt from "bcryptjs";
import { User, type AppRole } from "../models/User.js";
import { Activity } from "../models/Activity.js";
import { generateToken } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
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

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
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

    // Public registration always assigns the server-set default role "developer"
    const userRole: AppRole = "developer";

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
    });

    // Side effect: Record registration activity
    await Activity.create({
      actor: user._id,
      message: `joined Northpeak as ${user.role}`,
    });

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      token,
      user: serializeAuthUser(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    if (typeof email !== "string" || typeof password !== "string") {
      throw new AppError("Email and password must be strings", 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      token,
      user: serializeAuthUser(user),
    };
  }

  async getProfile(userId: string): Promise<SerializedUserProfile> {
    const user = await User.findById(userId).select("name email role createdAt");
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
