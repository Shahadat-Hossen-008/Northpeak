import type { ComponentType } from "react";
import { TaskFilters } from "../task-filters";
import { TaskCard } from "../task-card";
import { TaskBoard } from "../task-board";
import { TaskDetail } from "../task-detail";
import { ProjectCard } from "../project-card";
import { ProjectOverviewCard, ProjectTasksList } from "../project-deliverables";
import { MemberDetailSheet } from "../member-detail-sheet";
import { CommentSection } from "../comment-section";
import { SubtaskList } from "../subtask-list";
import { NotificationPanel } from "../notification-panel";
import { ProjectStatusDonutChart } from "../charts/project-status-donut";
import { TaskStatusDonutChart } from "../charts/task-status-donut";
import type { SectionPropsMap, SectionType } from "./interface";

type SectionComponentMap = {
  [T in SectionType]: ComponentType<SectionPropsMap[T]>;
};

export const SECTION_REGISTRY = {
  "task-filters": TaskFilters,
  "task-card": TaskCard,
  "task-board": TaskBoard,
  "task-detail": TaskDetail,
  "project-card": ProjectCard,
  "project-overview": ProjectOverviewCard,
  "project-tasks-list": ProjectTasksList,
  "member-detail-sheet": MemberDetailSheet,
  "comment-section": CommentSection,
  "subtask-list": SubtaskList,
  "notification-panel": NotificationPanel,
  "project-status-donut": ProjectStatusDonutChart,
  "task-status-donut": TaskStatusDonutChart,
} satisfies SectionComponentMap;

export function getSection<T extends SectionType>(type: T): SectionComponentMap[T] {
  return SECTION_REGISTRY[type];
}
