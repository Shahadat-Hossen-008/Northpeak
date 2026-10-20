import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WORKFLOW_COLUMNS } from "@/components/badges/workflow-badge/columns";
import { useMembers, useUpdateTask } from "@/hooks/queries";
import type { Priority, TaskWorkflowStatus } from "@/types";
import { PRIORITIES, toInputDate, toIso } from "../utils";
import type { EditTaskDialogProps } from "./interface";

export function EditTaskDialog({
  task,
  developers: _propDevelopers,
  trigger,
}: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const update = useUpdateTask();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    developerId: task.assigned_developer_id || "unassigned",
    deadline: toInputDate(task.deadline),
    priority: task.priority,
    status: task.status ?? (task.is_completed ? "done" : "todo"),
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch eligible engineering team members for this task's project
  const {
    data: projectMembers,
    isLoading: isDevelopersLoading,
    isError: isDevelopersError,
  } = useMembers(open ? task.project_id : null);

  const eligibleDevelopers = useMemo(() => {
    return (projectMembers ?? []).filter((m) => m.role === "developer");
  }, [projectMembers]);

  useEffect(() => {
    if (open) {
      setForm({
        title: task.title,
        description: task.description,
        developerId: task.assigned_developer_id || "unassigned",
        deadline: toInputDate(task.deadline),
        priority: task.priority,
        status: task.status ?? (task.is_completed ? "done" : "todo"),
      });
      setError(null);
    }
  }, [open, task]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Task title must be at least 3 characters.");
      return;
    }
    setError(null);
    update.mutate(
      {
        id: task.id,
        projectId: task.project_id,
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_developer_id:
          form.developerId && form.developerId !== "unassigned" ? form.developerId : null,
        deadline: toIso(form.deadline),
        priority: form.priority,
        status: form.status,
      },
      {
        onSuccess: () => setOpen(false),
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to update task");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update task details, deadline, or reassign developer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input
              id="edit-task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <Label htmlFor="edit-task-desc">Description</Label>
            <Textarea
              id="edit-task-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="edit-task-assignee">Assigned developer</Label>
              <Select
                disabled={isDevelopersLoading}
                value={form.developerId || "unassigned"}
                onValueChange={(val) => setForm({ ...form, developerId: val })}
              >
                <SelectTrigger id="edit-task-assignee">
                  <SelectValue
                    placeholder={isDevelopersLoading ? "Loading developers…" : "Unassigned"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {form.developerId &&
                    form.developerId !== "unassigned" &&
                    !eligibleDevelopers.some((d) => d.id === form.developerId) && (
                      <SelectItem value={form.developerId} disabled>
                        {task.assignee?.name || "Former developer"} (Not in project team)
                      </SelectItem>
                    )}
                  {eligibleDevelopers.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.name}
                    </SelectItem>
                  ))}
                  {isDevelopersError ? (
                    <div className="px-2 py-1.5 text-xs text-destructive">
                      Failed to load team members
                    </div>
                  ) : null}
                  {!isDevelopersLoading && !isDevelopersError && eligibleDevelopers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No developers in this project team
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="edit-task-deadline">Deadline</Label>
              <Input
                id="edit-task-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="edit-task-priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => setForm({ ...form, priority: val as Priority })}
              >
                <SelectTrigger id="edit-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="edit-task-status">Workflow Stage</Label>
              <Select
                value={form.status}
                onValueChange={(val) => setForm({ ...form, status: val as TaskWorkflowStatus })}
              >
                <SelectTrigger id="edit-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_COLUMNS.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", col.dotColor)} />
                        {col.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending} loading={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditTaskDialog;
export type { EditTaskDialogProps } from "./interface";
