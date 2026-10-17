import type { TaskFiltersProps } from "../task-filters";
import type { TaskCardProps } from "../task-card";
import type { TaskBoardProps } from "../task-board";
import type { TaskDetailProps } from "../task-detail";
import type { ProjectCardProps } from "../project-card";
import type { ProjectOverviewCardProps, ProjectTasksListProps } from "../project-deliverables";
import type { MemberDetailSheetProps } from "../member-detail-sheet";
import type { CommentSectionProps } from "../comment-section";
import type { SubtaskListProps } from "../subtask-list";
import type { NotificationPanelProps } from "../notification-panel";
import type { ProjectStatusDonutChartProps } from "../charts/project-status-donut";
import type { TaskStatusDonutChartProps } from "../charts/task-status-donut";

export interface SectionPropsMap {
  "task-filters": TaskFiltersProps;
  "task-card": TaskCardProps;
  "task-board": TaskBoardProps;
  "task-detail": TaskDetailProps;
  "project-card": ProjectCardProps;
  "project-overview": ProjectOverviewCardProps;
  "project-tasks-list": ProjectTasksListProps;
  "member-detail-sheet": MemberDetailSheetProps;
  "comment-section": CommentSectionProps;
  "subtask-list": SubtaskListProps;
  "notification-panel": NotificationPanelProps;
  "project-status-donut": ProjectStatusDonutChartProps;
  "task-status-donut": TaskStatusDonutChartProps;
}

export type SectionType = keyof SectionPropsMap;

export interface SectionRendererProps<T extends SectionType = SectionType> {
  type: T;
  props: SectionPropsMap[T];
}
