import { Plus } from "lucide-react";
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
import { useCreateTask, useMembers } from "@/hooks/queries";
import type { Priority, TaskWorkflowStatus } from "@/types";
import { PRIORITIES, toIso } from "../utils";
import type { CreateTaskDialogProps } from "./interface";

export function CreateTaskDialog({
  actorId,
  projects,
  developers: _propDevelopers,
  defaultProjectId,
  defaultStatus = "todo",
  trigger,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const create = useCreateTask(actorId);
  const [form, setForm] = useState({
    projectId: defaultProjectId ?? "",
    title: "",
    description: "",
    developerId: "",
    deadline: "",
    priority: "medium" as Priority,
    status: (defaultStatus ?? "todo") as TaskWorkflowStatus,
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch eligible engineering team members for the currently selected project
  const {
    data: projectMembers,
    isLoading: isDevelopersLoading,
    isError: isDevelopersError,
  } = useMembers(open && form.projectId ? form.projectId : null);

  const eligibleDevelopers = useMemo(() => {
    if (!form.projectId) return [];
    return (projectMembers ?? []).filter((m) => m.role === "developer");
  }, [form.projectId, projectMembers]);

  useEffect(() => {
    if (open) {
      setForm({
        projectId: defaultProjectId ?? "",
        title: "",
        description: "",
        developerId: "",
        deadline: "",
        priority: "medium",
        status: (defaultStatus ?? "todo") as TaskWorkflowStatus,
      });
      setError(null);
    }
  }, [open, defaultProjectId, defaultStatus]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.projectId) return setError("Choose a project.");
    if (form.title.trim().length < 3) return setError("Task title must be at least 3 characters.");
    if (!form.deadline) return setError("Set a deadline so the status can be tracked.");
    setError(null);
    create.mutate(
      {
        project_id: form.projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_developer_id:
          form.developerId && form.developerId !== "unassigned" ? form.developerId : null,
        deadline: toIso(form.deadline),
        priority: form.priority,
        status: form.status,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            projectId: defaultProjectId ?? "",
            title: "",
            description: "",
            developerId: "",
            deadline: "",
            priority: "medium",
            status: (defaultStatus ?? "todo") as TaskWorkflowStatus,
          });
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to create task");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Assign work to a developer with a clear deadline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select
              value={form.projectId}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  projectId: value,
                  developerId: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Authentication API"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What needs to be built?"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Developer</Label>
              <Select
                disabled={!form.projectId || isDevelopersLoading}
                value={form.developerId || "unassigned"}
                onValueChange={(value) =>
                  setForm({ ...form, developerId: value === "unassigned" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !form.projectId
                        ? "Select a project first"
                        : isDevelopersLoading
                          ? "Loading developers…"
                          : "Assign to…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
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
                  {form.projectId &&
                  !isDevelopersLoading &&
                  !isDevelopersError &&
                  eligibleDevelopers.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No developers in this project team
                    </div>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-deadline">Deadline</Label>
              <Input
                id="task-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value as Priority })}
              >
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Workflow Stage</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as TaskWorkflowStatus })}
              >
                <SelectTrigger>
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
            <Button type="submit" disabled={create.isPending} loading={create.isPending}>
              {create.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTaskDialog;
export type { CreateTaskDialogProps } from "./interface";
