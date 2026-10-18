import mongoose, { isValidObjectId } from "mongoose";
import { Subtask, type ISubtask } from "../models/Subtask.js";
import { Task } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../middleware/error.js";
import { serializeSubtask, type SerializedSubtask } from "../serializers/subtask.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";
import { isDeveloperInProjectTeam } from "./team.js";

export interface CreateSubtaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
}

export interface UpdateSubtaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  is_completed?: unknown;
}

export class SubtaskService {
  private async canAccessTask(taskId: string, user: AuthUserPayload) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const project = await Project.findById(task.project);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
    const isAssignee = task.assignedDeveloper?.toString() === user.id;
    if (!isProjectManager && !isAssignee) {
      throw new AppError("Not authorized to view subtasks for this task", 403);
    }

    return task;
  }

  private async resolveAssignee(
    projectId: string,
    assignedDeveloperId: string | null,
  ): Promise<string | null> {
    if (assignedDeveloperId === null) return null;
    if (typeof assignedDeveloperId !== "string" || !isValidObjectId(assignedDeveloperId)) {
      throw new AppError("Invalid developer ID", 400);
    }

    const user = await User.findById(assignedDeveloperId).select("_id role");
    if (!user) throw new AppError("Developer not found", 404);
    if (user.role !== "developer") {
      throw new AppError("Assigned user must have developer role", 400);
    }
    if (!(await isDeveloperInProjectTeam(projectId, user._id))) {
      throw new AppError(
        "Developer does not belong to the selected project's engineering team",
        400,
      );
    }
    return user._id.toString();
  }

  private populateAssignee(query: any) {
    return query.populate("assignedDeveloper", "name");
  }

  async getAllSubtasks(user: AuthUserPayload): Promise<SerializedSubtask[]> {
    const tasks =
      user.role === "manager"
        ? await Task.find({ project: { $in: await Project.find({ manager: user.id }).distinct("_id") } }).select("_id")
        : await Task.find({ assignedDeveloper: user.id }).select("_id");
    const taskIds = tasks.map((task) => task._id);
    const subtasks = await this.populateAssignee(
      Subtask.find({ task: { $in: taskIds } }).sort({ createdAt: 1 }),
    );
    return subtasks.map(serializeSubtask);
  }

  async getSubtasksByTaskId(taskId: string, user: AuthUserPayload): Promise<SerializedSubtask[]> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Invalid task ID format", 400);
    }

    await this.canAccessTask(taskId, user);
    const subtasks = await this.populateAssignee(
      Subtask.find({ task: taskId }).sort({ createdAt: 1 }),
    );
    return subtasks.map(serializeSubtask);
  }

  async createSubtask(
    taskId: string,
    user: AuthUserPayload,
    input: CreateSubtaskInput,
  ): Promise<SerializedSubtask> {
    const { title, description, assigned_developer_id } = input;
    if ("task" in input || "project" in input) {
      throw new AppError("Subtask parent cannot be changed", 400);
    }
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

    const project = await Project.findById(task.project);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization: only the authorized project manager or the assigned developer
    const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
    const isAssignee = task.assignedDeveloper?.toString() === user.id;

    if (!isProjectManager && !isAssignee) {
      throw new AppError("Not authorized to add subtasks to this task", 403);
    }
    if (
      assigned_developer_id !== undefined &&
      assigned_developer_id !== null &&
      !isProjectManager
    ) {
      throw new AppError("Not authorized to assign subtasks", 403);
    }
    const assignedDeveloper =
      assigned_developer_id === undefined
        ? null
        : await this.resolveAssignee(task.project.toString(), assigned_developer_id);

    const subtask = await Subtask.create({
      task: task._id,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      assignedDeveloper,
    });

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: user.id,
      message: `added subtask "${subtask.title}"`,
    });

    const populated = await this.populateAssignee(Subtask.findById(subtask._id));
    return serializeSubtask(populated);
  }

  async updateSubtask(
    subtaskId: string,
    user: AuthUserPayload,
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
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const project = await Project.findById(task.project);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization: only the authorized project manager or the assigned developer
    const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
    const isAssignee = task.assignedDeveloper?.toString() === user.id;

    if (!isProjectManager && !isAssignee) {
      throw new AppError("Not authorized to modify this subtask", 403);
    }

    const { title, description, assigned_developer_id, is_completed } = input;
    if ("task" in input || "project" in input) {
      throw new AppError("Subtask parent cannot be changed", 400);
    }
    const assignmentProvided = Object.prototype.hasOwnProperty.call(input, "assigned_developer_id");
    if (assignmentProvided && user.role !== "manager") {
      throw new AppError("Not authorized to assign subtasks", 403);
    }

    if (title !== undefined) {
      if (!title.trim()) {
        throw new AppError("Subtask title is required", 400);
      }
      subtask.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        throw new AppError("Subtask description must be a string", 400);
      }
      subtask.description = description.trim();
    }
    if (assignmentProvided) {
      const resolvedAssignee = await this.resolveAssignee(
        task.project.toString(),
        assigned_developer_id ?? null,
      );
      subtask.assignedDeveloper = resolvedAssignee
        ? new mongoose.Types.ObjectId(resolvedAssignee)
        : null;
    }
    if (is_completed !== undefined) {
      if (typeof is_completed !== "boolean") {
        throw new AppError("is_completed must be a boolean", 400);
      }

      const nowDone = is_completed;
      subtask.isCompleted = nowDone;
      subtask.completedAt = nowDone ? new Date() : null;

      // Notify manager if completed
      if (nowDone) {
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
    const populated = await this.populateAssignee(Subtask.findById(subtask._id));
    return serializeSubtask(populated);
  }

  async deleteSubtask(
    subtaskId: string,
    user: AuthUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(subtaskId)) {
      throw new AppError("Subtask not found", 404);
    }

    const subtask = await Subtask.findById(subtaskId);
    if (!subtask) {
      throw new AppError("Subtask not found", 404);
    }

    const task = await Task.findById(subtask.task);
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const project = await Project.findById(task.project);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization: only the authorized project manager or the assigned developer
    const isProjectManager = user.role === "manager" && project.manager.toString() === user.id;
    const isAssignee = task.assignedDeveloper?.toString() === user.id;

    if (!isProjectManager && !isAssignee) {
      throw new AppError("Not authorized to delete this subtask", 403);
    }

    await subtask.deleteOne();
    return { success: true, message: "Subtask deleted" };
  }
}

export const subtaskService = new SubtaskService();
