import mongoose, { Document, Schema } from "mongoose";

export type Priority = "low" | "medium" | "high" | "critical";

export interface IProject extends Document {
  title: string;
  description: string;
  manager: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId[];
  startDate: Date | null;
  deadline: Date | null;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    manager: { type: Schema.Types.ObjectId, ref: "User", required: true },
    team: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    startDate: { type: Date, default: null },
    deadline: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      required: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

export const Project = mongoose.model<IProject>("Project", projectSchema);
