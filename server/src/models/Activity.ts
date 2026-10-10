import mongoose, { Document, Schema } from "mongoose";

export interface IActivity extends Document {
  project: mongoose.Types.ObjectId | null;
  task: mongoose.Types.ObjectId | null;
  actor: mongoose.Types.ObjectId | null;
  message: string;
  createdAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const Activity = mongoose.model<IActivity>("Activity", activitySchema);
