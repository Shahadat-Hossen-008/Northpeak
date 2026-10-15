import { isValidObjectId } from "mongoose";
import { Task, type ITask, type TaskWorkflowStatus } from "../models/Task.js";
import { Project } from "../models/Project.js";
import { User } from "../models/User.js";
import { Subtask } from "../models/Subtask.js";
import { Comment } from "../models/Comment.js";
import { Activity } from "../models/Activity.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../middleware/error.js";
import { escapeRegex } from "../lib/utils.js";
import { concurrencyTestBarriers } from "./team.js";
import { serializeTask, type SerializedTask } from "../serializers/task.serializer.js";
import type { AuthUserPayload } from "../middleware/auth.js";

export interface CreateTaskInput {
  project_id?: string;
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  deadline?: string | null;
  priority?: any;
  status?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assigned_developer_id?: string | null;
  deadline?: string | null;
  priority?: any;
  status?: string;
  is_completed?: any;
}

export interface AssigneeResolution {
  isDefined: boolean;
  user: any | null;
  id: string | null;
}

export class TaskService {
  private async fetchPopulatedTask(taskId: any): Promise<SerializedTask> {
    const populated = await Task.findById(taskId)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");
    return serializeTask(populated);
  }

  private async validateAndResolveAssignee(
    projectId: any,
    assignedDevId?: string | null,
  ): Promise<AssigneeResolution> {
    if (assignedDevId === undefined) {
      return { isDefined: false, user: null, id: null };
    }

    if (!assignedDevId || assignedDevId === "unassigned") {
      return { isDefined: true, user: null, id: null };
    }

    if (!isValidObjectId(assignedDevId)) {
      throw new AppError("Invalid developer ID", 400);
    }

    const devUser = await User.findById(assignedDevId);
    if (!devUser) {
      throw new AppError("Developer not found", 404);
    }

    if (devUser.role !== "developer") {
      throw new AppError("Assigned user must have developer role", 400);
    }

    // Atomic project-team membership check coordinated with the project document
    const projectWithMember = await Project.findOneAndUpdate(
      {
        _id: projectId,
        team: devUser._id,
      },
      { $set: { updatedAt: new Date() } },
      { new: true },
    );

    if (!projectWithMember) {
      throw new AppError(
        "Developer does not belong to the selected project's engineering team",
        400,
      );
    }

    return {
      isDefined: true,
      user: devUser,
      id: devUser._id.toString(),
    };
  }

  private applyTaskWorkflowState(
    task: { status?: any; isCompleted?: any; completedAt?: any },
    status?: string,
    isCompletedInput?: any,
  ): void {
    if (status !== undefined && ["todo", "in_progress", "in_review", "done"].includes(status)) {
      task.status = status as TaskWorkflowStatus;
      if (status === "done") {
        task.isCompleted = true;
        if (!task.completedAt) task.completedAt = new Date();
      } else {
        task.isCompleted = false;
        task.completedAt = null;
      }
    } else if (isCompletedInput !== undefined) {
      const isCompleted = Boolean(isCompletedInput);
      task.isCompleted = isCompleted;
      if (isCompleted) {
        if (!task.completedAt) task.completedAt = new Date();
        task.status = "done";
      } else {
        task.completedAt = null;
        task.status = "todo";
      }
    }
  }

  async getTasks(query: any): Promise<SerializedTask[]> {
    const {
      project_id,
      projectId,
      assigned_to,
      assignedTo,
      priority,
      status,
      is_completed,
      search,
    } = query;
    const filter: Record<string, any> = {};

    const targetProjectId = (project_id || projectId) as string;
    if (targetProjectId && isValidObjectId(targetProjectId)) {
      filter.project = targetProjectId;
    }
    const targetAssignedTo = (assigned_to || assignedTo) as string;
    if (targetAssignedTo && isValidObjectId(targetAssignedTo)) {
      filter.assignedDeveloper = targetAssignedTo;
    }
    if (priority && typeof priority === "string") {
      filter.priority = priority;
    }
    if (status && typeof status === "string") {
      filter.status = status;
    }
    if (is_completed !== undefined) {
      filter.isCompleted = is_completed === "true";
    }
    if (search && typeof search === "string" && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ];
    }

    const tasks = await Task.find(filter)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email")
      .sort({ deadline: 1 });

    return tasks.map(serializeTask);
  }

  async getTaskById(taskId: string): Promise<SerializedTask> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Task not found", 404);
    }

    const task = await Task.findById(taskId)
      .populate("project", "title")
      .populate("assignedDeveloper", "name email");

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    return serializeTask(task);
  }

  async createTask(user: AuthUserPayload, input: CreateTaskInput): Promise<SerializedTask> {
    const { project_id, title, description, assigned_developer_id, deadline, priority, status } =
      input;

    if (!project_id || !title || title.trim().length < 3) {
      throw new AppError("Project and task title (min 3 chars) are required", 400);
    }

    if (!isValidObjectId(project_id)) {
      throw new AppError("Invalid project ID", 400);
    }

    const project = await Project.findById(project_id);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization boundary: Only the authorized project manager can create tasks for this project
    if (project.manager.toString() !== user.id) {
      throw new AppError("Not authorized to create tasks for this project", 403);
    }

    const assignee = await this.validateAndResolveAssignee(project._id, assigned_developer_id);
    const assignedDevId = assignee.id;

    const task = new Task({
      project: project._id,
      title: title.trim(),
      description: (description || "").trim(),
      assignedDeveloper: assignedDevId,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || "medium",
      status: "todo",
      isCompleted: false,
      completedAt: null,
    });
    if (status) {
      this.applyTaskWorkflowState(task, status);
    }
    await task.save();

    if (concurrencyTestBarriers.afterTaskCreateSave) {
      await concurrencyTestBarriers.afterTaskCreateSave();
    }

    // Concurrency guard: verify that assigned developer was not removed during task creation
    if (assignedDevId) {
      const currentProject = await Project.findById(project._id).select("team");
      const isStillMember = currentProject?.team?.some((id) => id.toString() === assignedDevId);
      if (!isStillMember) {
        await Task.findByIdAndDelete(task._id);
        throw new AppError(
          "Developer does not belong to the selected project's engineering team",
          400,
        );
      }
    }

    if (concurrencyTestBarriers.afterTaskCreateMembershipCheck) {
      await concurrencyTestBarriers.afterTaskCreateMembershipCheck();
    }

    // Record activity
    await Activity.create({
      project: project._id,
      task: task._id,
      actor: user.id,
      message: `created task ${task.title}`,
    });

    // Notify assigned developer if specified
    if (task.assignedDeveloper) {
      await Notification.create({
        recipient: task.assignedDeveloper,
        kind: "task_assigned",
        title: "New task assigned",
        body: task.title,
        task: task._id,
        project: project._id,
      });
    }

    return this.fetchPopulatedTask(task._id);
  }

  async updateTask(
    taskId: string,
    user: AuthUserPayload,
    input: UpdateTaskInput,
  ): Promise<SerializedTask> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Task not found", 404);
    }

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const isManager = user.role === "manager";
    const isAssignee = task.assignedDeveloper?.toString() === user.id;

    if (!isManager && !isAssignee) {
      throw new AppError("Not authorized to update this task", 403);
    }

    const project = await Project.findById(task.project);
    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Authorization boundary: Manager must be the manager of this project
    if (isManager && project.manager.toString() !== user.id) {
      throw new AppError("Not authorized to manage tasks for this project", 403);
    }

    const { title, description, assigned_developer_id, deadline, priority, is_completed, status } =
      input;

    const previousAssignee = task.assignedDeveloper?.toString();
    const previousStatus = task.status;

    let assignedDevUser: any = null;
    // Check developer reassignment authorization & project team membership
    if (assigned_developer_id !== undefined) {
      if (!isManager) {
        throw new AppError("Not authorized to reassign this task", 403);
      }

      const assignee = await this.validateAndResolveAssignee(task.project, assigned_developer_id);
      task.assignedDeveloper = assignee.user ? assignee.user._id : null;
      assignedDevUser = assignee.user;
    }

    // Managers can update all other task fields
    if (isManager) {
      if (title !== undefined) task.title = title.trim();
      if (description !== undefined) task.description = description.trim();
      if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;
      if (priority !== undefined) task.priority = priority;
    }

    // Both manager and assignee can update workflow status
    this.applyTaskWorkflowState(task, status, is_completed);

    await task.save();

    if (concurrencyTestBarriers.afterTaskPatchSave) {
      await concurrencyTestBarriers.afterTaskPatchSave();
    }

    // Concurrency guard: verify developer wasn't concurrently removed from project team
    if (assignedDevUser) {
      const currentProject = await Project.findById(task.project).select("team");
      const isStillMember = currentProject?.team?.some(
        (id) => id.toString() === assignedDevUser._id.toString(),
      );
      if (!isStillMember) {
        task.assignedDeveloper = null;
        await task.save();
        throw new AppError(
          "Developer does not belong to the selected project's engineering team",
          400,
        );
      }
    }

    if (concurrencyTestBarriers.afterTaskPatchMembershipCheck) {
      await concurrencyTestBarriers.afterTaskPatchMembershipCheck();
    }

    // Activity log
    const activityMsg =
      status !== undefined && status !== previousStatus
        ? `moved ${task.title} to ${status.replace("_", " ")}`
        : `updated task ${task.title}`;

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: user.id,
      message: activityMsg,
    });

    // Notify new developer if assignment changed
    if (
      isManager &&
      task.assignedDeveloper &&
      task.assignedDeveloper.toString() !== previousAssignee
    ) {
      await Notification.create({
        recipient: task.assignedDeveloper,
        kind: "task_assigned",
        title: "New task assigned",
        body: task.title,
        task: task._id,
        project: task.project,
      });
    }

    return this.fetchPopulatedTask(task._id);
  }

  async toggleComplete(
    taskId: string,
    user: AuthUserPayload,
    completed: any,
  ): Promise<SerializedTask> {
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

    const isManager = user.role === "manager";
    const isProjectManager = isManager && project.manager.toString() === user.id;
    const isAssignee = task.assignedDeveloper?.toString() === user.id;

    if (!isProjectManager && !isAssignee) {
      throw new AppError("Not authorized to update this task", 403);
    }

    this.applyTaskWorkflowState(task, undefined, completed);
    const isCompleted = task.isCompleted;
    await task.save();

    await Activity.create({
      project: task.project,
      task: task._id,
      actor: user.id,
      message: `${isCompleted ? "completed" : "reopened"} ${task.title}`,
    });

    return this.fetchPopulatedTask(task._id);
  }

  async deleteTask(
    taskId: string,
    user: AuthUserPayload,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(taskId)) {
      throw new AppError("Task not found", 404);
    }

    const task = await Task.findById(taskId);
    if (!task) {
      throw new AppError("Task not found", 404);
    }

    const project = await Project.findById(task.project);
    if (!project || project.manager.toString() !== user.id) {
      throw new AppError("Not authorized to delete tasks for this project", 403);
    }

    // Cascade delete subtasks, comments, activity, notifications for this task
    await Subtask.deleteMany({ task: task._id });
    await Comment.deleteMany({ task: task._id });
    await Activity.deleteMany({ task: task._id });
    await Notification.deleteMany({ task: task._id });
    await task.deleteOne();

    return { success: true, message: "Task deleted successfully" };
  }
}

export const taskService = new TaskService();
