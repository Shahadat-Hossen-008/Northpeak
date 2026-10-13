import { statusOf } from "@/components/badges/utils";
import type { Member, Project, Task } from "@/types";

export interface DeveloperWorkloadMetric {
  member: Member;
  activeCount: number;
  overdueCount: number;
  loadPercentage: number;
}

export interface ManagerDashboardMetrics {
  allTasks: Task[];
  allProjects: Project[];
  developers: Member[];
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: Task[];
  allOverdueTasks: Task[];
  activeProjects: Project[];
  upcomingTasks: Task[];
  overallPercentage: number;
  completedPercentage: number;
  inProgressPercentage: number;
  overduePercentage: number;
  developerWorkloads: DeveloperWorkloadMetric[];
}

export function selectManagerDashboardMetrics(params: {
  tasks: Task[] | undefined;
  projects: Project[] | undefined;
  members: Member[] | undefined;
}): ManagerDashboardMetrics {
  const allTasks = params.tasks ?? [];
  const allProjects = params.projects ?? [];
  const developers = (params.members ?? []).filter((m) => m.role === "developer");

  const completedTasks = allTasks.filter((t) => t.is_completed || t.status === "done").length;
  const inProgressTasks = allTasks.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      (t.status === "in_progress" || t.status === "in_review"),
  ).length;

  const overdueTasks = allTasks.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      t.status !== "in_progress" &&
      t.status !== "in_review" &&
      statusOf(t) === "overdue",
  );

  const allOverdueTasks = allTasks.filter(
    (t) => !t.is_completed && t.status !== "done" && statusOf(t) === "overdue",
  );

  const activeProjects = allProjects.filter((project) => {
    const projectTasks = allTasks.filter((t) => t.project_id === project.id);
    return projectTasks.length === 0 || projectTasks.some((t) => !t.is_completed);
  });

  const upcomingTasks = allTasks
    .filter((t) => !t.is_completed && t.deadline && new Date(t.deadline) >= new Date())
    .slice(0, 6);

  const total = allTasks.length;
  const overallPercentage = total > 0 ? Math.round((completedTasks / total) * 100) : 0;
  const completedPercentage = overallPercentage;
  const inProgressPercentage = total > 0 ? Math.round((inProgressTasks / total) * 100) : 0;
  const overduePercentage = total > 0 ? Math.round((overdueTasks.length / total) * 100) : 0;

  const developerWorkloads: DeveloperWorkloadMetric[] = developers.map((member) => {
    const mine = allTasks.filter((t) => t.assigned_developer_id === member.id);
    const activeCount = mine.filter((t) => !t.is_completed).length;
    const overdueCount = mine.filter((t) => statusOf(t) === "overdue").length;
    const loadPercentage = Math.min(100, activeCount * 20);
    return {
      member,
      activeCount,
      overdueCount,
      loadPercentage,
    };
  });

  return {
    allTasks,
    allProjects,
    developers,
    completedTasks,
    inProgressTasks,
    overdueTasks,
    allOverdueTasks,
    activeProjects,
    upcomingTasks,
    overallPercentage,
    completedPercentage,
    inProgressPercentage,
    overduePercentage,
    developerWorkloads,
  };
}

export interface DeveloperDashboardMetrics {
  mine: Task[];
  myProjects: Project[];
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
  overallPercentage: number;
  completedPercentage: number;
  inProgressPercentage: number;
  overduePercentage: number;
}

export function selectDeveloperDashboardMetrics(params: {
  tasks: Task[] | undefined;
  projects: Project[] | undefined;
  profileId: string | null | undefined;
}): DeveloperDashboardMetrics {
  const allTasks = params.tasks ?? [];
  const allProjects = params.projects ?? [];
  const profileId = params.profileId ?? "";

  const mine = allTasks.filter((t) => t.assigned_developer_id === profileId);

  const myProjects = allProjects.filter((p) => {
    const isTeam = p.team?.includes(profileId);
    const hasTasks = mine.some((t) => t.project_id === p.id);
    return isTeam || hasTasks;
  });

  const completedCount = mine.filter((t) => t.is_completed || t.status === "done").length;
  const inProgressCount = mine.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      (t.status === "in_progress" || t.status === "in_review"),
  ).length;

  const overdueCount = mine.filter(
    (t) =>
      !t.is_completed &&
      t.status !== "done" &&
      t.status !== "in_progress" &&
      t.status !== "in_review" &&
      statusOf(t) === "overdue",
  ).length;

  const total = mine.length;
  const overallPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const completedPercentage = overallPercentage;
  const inProgressPercentage = total > 0 ? Math.round((inProgressCount / total) * 100) : 0;
  const overduePercentage = total > 0 ? Math.round((overdueCount / total) * 100) : 0;

  return {
    mine,
    myProjects,
    completedCount,
    inProgressCount,
    overdueCount,
    overallPercentage,
    completedPercentage,
    inProgressPercentage,
    overduePercentage,
  };
}
