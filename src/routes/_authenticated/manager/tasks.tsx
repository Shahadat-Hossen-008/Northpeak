import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { CreateTaskDialog } from "@/components/dialogs";
import { ErrorState, LoadingState, PageHeader } from "@/components/primitives";
import { meta } from "@/components/pages";
import { TaskFilters, TaskTable, useFilteredTasks } from "@/components/tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAllSubtasks, useDeleteTask, useMembers, useProjects, useTasks, type Task } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/manager/tasks")({
  head: () => meta("All tasks", "Search, filter and sort every task across your projects."),
  component: ManagerTasks,
});

function ManagerTasks() {
  const { profile } = useAuth();
  const tasks = useTasks();
  const projects = useProjects();
  const subtasks = useAllSubtasks();
  const members = useMembers();
  const developers = (members.data ?? []).filter((m) => m.role === "developer");
  const { filters, setFilters, filtered } = useFilteredTasks(tasks.data ?? [], subtasks.data ?? []);
  const del = useDeleteTask();
  const [pending, setPending] = useState<Task | null>(null);

  return (
    <AppShell section="manager">
      <PageHeader
        title="Tasks"
        description="Every task across your projects with live deadline status."
        action={<CreateTaskDialog actorId={profile?.id ?? null} projects={projects.data ?? []} developers={developers} />}
      />
      <div className="mt-6 space-y-4">
        <TaskFilters filters={filters} setFilters={setFilters} developers={developers} />
        {tasks.isLoading ? (
          <LoadingState />
        ) : tasks.isError ? (
          <ErrorState message={(tasks.error as Error).message} />
        ) : (
          <TaskTable
            tasks={filtered}
            subtasks={subtasks.data ?? []}
            hrefFor={(t) => `/manager/tasks/${t.id}`}
            onDelete={setPending}
          />
        )}
      </div>
      <ConfirmDelete task={pending} onClose={() => setPending(null)} onConfirm={(t) => del.mutate(t.id)} />
    </AppShell>
  );
}

export function ConfirmDelete({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => void;
}) {
  return (
    <AlertDialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            "{task?.title}" and its subtasks and comments will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (task) onConfirm(task);
              onClose();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
