// Pending registration model – holds temporary data until email OTP verification.
// Stores only hashed password and OTP hash; no plaintext credentials.
import mongoose, { Schema } from "mongoose";

export interface IPendingRegistration {
  email: string; // normalized, unique
  name: string;
  passwordHash: string;
  role: "manager" | "developer";
  codeHash: string; // HMAC of OTP
  expiresAt: Date; // OTP expiry (10 min)
  resendAvailableAt: Date; // cooldown (60 s)
  attempts: number; // OTP verification attempts
}

const pendingRegSchema = new Schema<IPendingRegistration>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["manager", "developer"], required: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

// TTL index removes stale pending registrations after OTP expiry.
pendingRegSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = mongoose.model<IPendingRegistration>(
  "PendingRegistration",
  pendingRegSchema,
);
