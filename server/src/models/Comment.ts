import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  task: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  },
);

commentSchema.index({ task: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
