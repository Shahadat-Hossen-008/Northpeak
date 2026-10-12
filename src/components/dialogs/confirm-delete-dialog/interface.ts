import type { Task } from "@/types";

export interface ConfirmDeleteDialogProps {
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => void;
}
