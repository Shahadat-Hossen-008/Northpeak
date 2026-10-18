import { ConfirmActionDialog } from "../confirm-action-dialog";
import type { ConfirmDeleteDialogProps } from "./interface";

export function ConfirmDeleteDialog({ task, onClose, onConfirm }: ConfirmDeleteDialogProps) {
  if (!task) return null;

  return (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Delete this task?"
      description={`"${task.title}" and its subtasks and comments will be permanently removed.`}
      confirmLabel="Delete task"
      onConfirm={() => onConfirm(task)}
    />
  );
}

export { ConfirmDeleteDialog as ConfirmDelete };
export default ConfirmDeleteDialog;
export type { ConfirmDeleteDialogProps } from "./interface";
