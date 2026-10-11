import mongoose, { isValidObjectId } from "mongoose";
import { Project } from "../models/Project.js";
import { User, type IUser } from "../models/User.js";

/**
 * Returns the IDs of all developers who belong to a project's engineering team.
 *
 * Explicit project-team membership stored in `project.team` is the authoritative source of truth:
 * - Does not infer membership from tasks.
 * - Developers on the team are eligible even if they currently have 0 tasks assigned.
 * - Legacy or empty teams return [] safely without inventing memberships.
 * - Verified against the User model to ensure role === "developer".
 */
export async function getProjectEngineeringTeamIds(
  projectId: string | mongoose.Types.ObjectId,
): Promise<string[]> {
  if (!isValidObjectId(projectId)) {
    return [];
  }

  const project = await Project.findById(projectId).select("team");
  if (!project || !Array.isArray(project.team) || project.team.length === 0) {
    return [];
  }

  const explicitTeam = project.team.filter(Boolean).map((id) => id.toString());
  if (explicitTeam.length === 0) {
    return [];
  }

  // Verify that these users exist and have developer role
  const validDevs = await User.find({
    _id: { $in: explicitTeam },
    role: "developer",
  }).select("_id");

  return validDevs.map((d) => d._id.toString());
}

/**
 * Checks whether a specific developer belongs to a project's engineering team.
 */
export async function isDeveloperInProjectTeam(
  projectId: string | mongoose.Types.ObjectId,
  developerId: string | mongoose.Types.ObjectId,
): Promise<boolean> {
  if (!isValidObjectId(projectId) || !isValidObjectId(developerId)) {
    return false;
  }

  const teamIds = await getProjectEngineeringTeamIds(projectId);
  return teamIds.includes(developerId.toString());
}

/**
 * Retrieves full developer User documents belonging to a project's engineering team.
 */
export async function getProjectEligibleDevelopers(
  projectId: string | mongoose.Types.ObjectId,
): Promise<IUser[]> {
  const teamIds = await getProjectEngineeringTeamIds(projectId);
  if (teamIds.length === 0) {
    return [];
  }

  return User.find({
    _id: { $in: teamIds },
    role: "developer",
  })
    .select("name email role createdAt")
    .sort({ name: 1 });
}

interface BarrierAction {
  emit?: string;
  wait?: string;
}

class BarrierManager {
  private eventWaiters = new Map<string, Array<() => void>>();
  private emittedEvents = new Set<string>();

  public afterTaskCreateSave: (() => Promise<void>) | null = null;
  public afterTaskCreateMembershipCheck: (() => Promise<void>) | null = null;
  public afterTaskPatchSave: (() => Promise<void>) | null = null;
  public afterTaskPatchMembershipCheck: (() => Promise<void>) | null = null;
  public duringProjectTeamRemoval: (() => Promise<void>) | null = null;
  public beforeProjectSave: (() => Promise<void>) | null = null;
  public simulateRemovalFailure: boolean = false;

  public emit(eventName: string): void {
    this.emittedEvents.add(eventName);
    const waiters = this.eventWaiters.get(eventName);
    if (waiters && waiters.length > 0) {
      this.eventWaiters.delete(eventName);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  public async wait(eventName: string, timeoutMs = 10000): Promise<boolean> {
    if (this.emittedEvents.has(eventName)) {
      this.emittedEvents.delete(eventName);
      return true;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const arr = this.eventWaiters.get(eventName) || [];
        this.eventWaiters.set(
          eventName,
          arr.filter((cb) => cb !== onResolve),
        );
        reject(new Error(`Timeout waiting for barrier event: ${eventName}`));
      }, timeoutMs);

      const onResolve = () => {
        clearTimeout(timer);
        this.emittedEvents.delete(eventName);
        resolve(true);
      };

      const existing = this.eventWaiters.get(eventName) || [];
      existing.push(onResolve);
      this.eventWaiters.set(eventName, existing);
    });
  }

  public setHook(
    hookName:
      | "afterTaskCreateSave"
      | "afterTaskCreateMembershipCheck"
      | "afterTaskPatchSave"
      | "afterTaskPatchMembershipCheck"
      | "duringProjectTeamRemoval"
      | "beforeProjectSave",
    action: BarrierAction | null,
  ) {
    if (!action) {
      this[hookName] = null;
      return;
    }
    this[hookName] = async () => {
      if (action.emit) {
        this.emit(action.emit);
      }
      if (action.wait) {
        await this.wait(action.wait);
      }
    };
  }

  public reset() {
    this.afterTaskCreateSave = null;
    this.afterTaskCreateMembershipCheck = null;
    this.afterTaskPatchSave = null;
    this.afterTaskPatchMembershipCheck = null;
    this.duringProjectTeamRemoval = null;
    this.beforeProjectSave = null;
    this.simulateRemovalFailure = false;
    this.emittedEvents.clear();
    this.eventWaiters.clear();
  }
}

/**
 * Test synchronization barriers for deterministic concurrent testing.
 * In production / regular operation, all barrier hooks are null (zero overhead).
 */
export const concurrencyTestBarriers = new BarrierManager();
