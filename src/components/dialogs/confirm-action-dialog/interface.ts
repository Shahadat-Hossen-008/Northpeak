import type { ReactNode } from "react";

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}
