import mongoose, { Document, Schema } from "mongoose";
import type { Priority } from "./Project.js";

export type TaskWorkflowStatus = "todo" | "in_progress" | "in_review" | "done";

export interface ITask extends Document {
  project: mongoose.Types.ObjectId;
  title: string;
  description: string;
  assignedDeveloper: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId | null;
  assignedBy: mongoose.Types.ObjectId | null;
  deadline: Date | null;
  priority: Priority;
  status: TaskWorkflowStatus;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    assignedDeveloper: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deadline: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      required: true,
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "done"],
      default: "todo",
      required: true,
    },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedDeveloper: 1, status: 1 });
taskSchema.index({ deadline: 1 });

export const Task = mongoose.model<ITask>("Task", taskSchema);
