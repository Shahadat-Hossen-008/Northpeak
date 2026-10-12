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
import { useDeleteTask } from "@/hooks/queries";
import type { DeleteTaskDialogProps } from "./interface";

export function DeleteTaskDialog({ task, trigger, onDeleted }: DeleteTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const del = useDeleteTask();

  function handleDelete() {
    del.mutate(task.id, {
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
            Delete task
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task "{task.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All subtasks and comments belonging to this task will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-danger text-danger-foreground hover:bg-danger/90"
            disabled={del.isPending}
          >
            {del.isPending ? "Deleting…" : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteTaskDialog;
export type { DeleteTaskDialogProps } from "./interface";
