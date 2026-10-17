import type { DeadlineState, Priority, TaskWorkflowStatus } from "@/types/frontend";

export interface PrototypeSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PrototypeTask {
  id: string;
  title: string;
  assignee: {
    name: string;
    role: string;
    handle: string;
  };
  priority: Priority;
  workflowState: TaskWorkflowStatus;
  dueDay: number; // Sprint day on which task is due (1-14)
  subtasks: PrototypeSubtask[];
  completedAtDay?: number;
}

export interface ComputedPrototypeTask extends PrototypeTask {
  deadlineState: DeadlineState;
  completedSubtasks: number;
  progressPercent: number;
}

export interface SimulationMetrics {
  total: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  onTrack: number;
  overallProgress: number;
}

export interface SprintCheckpoint {
  day: number;
  label: string;
  phase: string;
}

export interface DeadlineStateInfo {
  state: DeadlineState;
  title: string;
  rule: string;
  description: string;
  badgeTone: string;
}
