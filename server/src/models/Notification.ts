import mongoose, { Document, Schema } from "mongoose";
import type { AppRole } from "./User.js";

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId | null;
  audience: AppRole | null;
  kind: string;
  title: string;
  body: string;
  task: mongoose.Types.ObjectId | null;
  project: mongoose.Types.ObjectId | null;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", default: null },
    audience: { type: String, enum: ["manager", "developer", null], default: null },
    kind: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
