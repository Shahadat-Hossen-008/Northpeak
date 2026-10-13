import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/hooks/queries";
import type { DeleteProjectDialogProps } from "./interface";

export function DeleteProjectDialog({ project, trigger, onDeleted }: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const del = useDeleteProject();

  function handleDelete() {
    del.mutate(project.id, {
      onSuccess: () => {
        setOpen(false);
        if (onDeleted) onDeleted();
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive-outline" size="sm">
            <Trash2 className="size-4" />
            Delete project
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project "{project.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All tasks, subtasks, comments, and activities belonging to
            this project will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-danger text-danger-foreground hover:bg-danger/90"
          >
            {del.isPending ? "Deleting…" : "Delete project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteProjectDialog;
export type { DeleteProjectDialogProps } from "./interface";
