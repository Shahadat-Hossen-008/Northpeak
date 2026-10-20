import mongoose, { Document, Schema } from "mongoose";

export type AppRole = "manager" | "developer";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  googleId?: string;
  emailVerified?: boolean;
  role: AppRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: false, select: false },
    googleId: { type: String, unique: true, sparse: true, select: false },
    // Existing seed and production accounts remain trusted; registration opts out explicitly.
    emailVerified: { type: Boolean, default: true },
    role: {
      type: String,
      enum: ["manager", "developer"],
      default: "developer",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model<IUser>("User", userSchema);
