import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "../confirm-action-dialog";
import { useDeleteTask } from "@/hooks/queries";
import type { DeleteTaskDialogProps } from "./interface";

export function DeleteTaskDialog({ task, trigger, onDeleted }: DeleteTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const del = useDeleteTask();

  async function handleDelete() {
    await del.mutateAsync(task.id);
    onDeleted?.();
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={setOpen}
      title={`Delete task "${task.title}"?`}
      description="This action cannot be undone. All subtasks and comments belonging to this task will be permanently deleted."
      confirmLabel="Delete task"
      pendingLabel="Deleting…"
      pending={del.isPending}
      onConfirm={handleDelete}
    >
      {trigger ?? (
        <Button variant="destructive-outline" size="sm">
          <Trash2 className="size-4" />
          Delete task
        </Button>
      )}
    </ConfirmActionDialog>
  );
}

export default DeleteTaskDialog;
export type { DeleteTaskDialogProps } from "./interface";
