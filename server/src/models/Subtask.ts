import mongoose, { Document, Schema } from "mongoose";

export interface ISubtask extends Document {
  task: mongoose.Types.ObjectId;
  title: string;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subtaskSchema = new Schema<ISubtask>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

export const Subtask = mongoose.model<ISubtask>("Subtask", subtaskSchema);
