import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "../confirm-action-dialog";
import { useDeleteProject } from "@/hooks/queries";
import type { DeleteProjectDialogProps } from "./interface";

export function DeleteProjectDialog({ project, trigger, onDeleted }: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const del = useDeleteProject();

  async function handleDelete() {
    await del.mutateAsync(project.id);
    onDeleted?.();
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={setOpen}
      title={`Delete project "${project.title}"?`}
      description="This action cannot be undone. All tasks, subtasks, comments, and activities belonging to this project will be permanently deleted."
      confirmLabel="Delete project"
      pendingLabel="Deleting…"
      pending={del.isPending}
      onConfirm={handleDelete}
    >
      {trigger ?? (
        <Button variant="destructive-outline" size="sm">
          <Trash2 className="size-4" />
          Delete project
        </Button>
      )}
    </ConfirmActionDialog>
  );
}

export default DeleteProjectDialog;
export type { DeleteProjectDialogProps } from "./interface";
