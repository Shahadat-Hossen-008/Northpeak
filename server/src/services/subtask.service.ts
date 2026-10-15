import { isValidObjectId } from "mongoose";
import { Subtask } from "../models/Subtask.js";
import { Task } from "../models/Task.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../middleware/error.js";
import { serializeSubtask, type SerializedSubtask } from "../serializers/subtask.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";

export interface CreateSubtaskInput {
  title?: string;
}

export interface UpdateSubtaskInput {
  title?: string;
  is_completed?: any;
}

export class SubtaskService {
  async getAllSubtasks(): Promise<SerializedSubtask[]> {
    const subtasks = await Subtask.find().sort({ createdAt: 1 });
    return subtasks.map(serializeSubtask);
  }

  async getSubtasksByTaskId(taskId: string): Promise<SerializedSubtask[]> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Invalid task ID format", 400);
    }

    const subtasks = await Subtask.find({ task: taskId }).sort({ createdAt: 1 });
    return subtasks.map(serializeSubtask);
  }

  async createSubtask(
    taskId: string,
    user: AuthUserPayload,
    input: CreateSubtaskInput,
  ): Promise<SerializedSubtask> {
    const { title } = input;
    if (!title || !title.trim()) {
      throw new AppError("Subtask title is required", 400);
    }

    if (!isValidObjectId(taskId)) {
      throw new AppError("Task not found", 404);
    }

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const subtask = await Subtask.create({
      task: task._id,
      title: title.trim(),
    });

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: user.id,
      message: `added subtask "${subtask.title}"`,
    });

    return serializeSubtask(subtask);
  }

  async updateSubtask(
    subtaskId: string,
    _user: AuthUserPayload,
    input: UpdateSubtaskInput,
  ): Promise<SerializedSubtask> {
    if (!isValidObjectId(subtaskId)) {
      throw new AppError("Subtask not found", 404);
    }

    const subtask = await Subtask.findById(subtaskId);
    if (!subtask) {
      throw new AppError("Subtask not found", 404);
    }

    const task = await Task.findById(subtask.task);
    const { title, is_completed } = input;

    if (title !== undefined) {
      subtask.title = title.trim();
    }

    if (is_completed !== undefined) {
      const nowDone = Boolean(is_completed);
      subtask.isCompleted = nowDone;
      subtask.completedAt = nowDone ? new Date() : null;

      // Notify manager if completed
      if (nowDone && task) {
        await Notification.create({
          audience: "manager",
          kind: "subtask_completed",
          title: "Subtask completed",
          body: `${subtask.title} was marked complete.`,
          task: task._id,
          project: task.project,
        });
      }
    }

    await subtask.save();
    return serializeSubtask(subtask);
  }

  async deleteSubtask(
    subtaskId: string,
    _user: AuthUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(subtaskId)) {
      throw new AppError("Subtask not found", 404);
    }

    const subtask = await Subtask.findById(subtaskId);
    if (!subtask) {
      throw new AppError("Subtask not found", 404);
    }

    await subtask.deleteOne();
    return { success: true, message: "Subtask deleted" };
  }
}

export const subtaskService = new SubtaskService();
