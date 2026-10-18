export interface SubtaskListProps {
  taskId: string;
  projectId: string;
  actorId: string | null;
  canEdit: boolean;
  canAssign: boolean;
}
