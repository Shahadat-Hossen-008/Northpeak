import mongoose, { Document, Schema } from "mongoose";

export type AppRole = "manager" | "developer";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
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
    passwordHash: { type: String, required: true },
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
