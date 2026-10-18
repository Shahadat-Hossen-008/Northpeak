import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { UserAvatar } from "@/components/avatar";
import { WORKFLOW_COLUMNS } from "@/components/badges/workflow-badge/columns";
import { useCreateTask, useMembers } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import type { Priority, TaskWorkflowStatus } from "@/types";
import { PRIORITIES, toIso } from "../utils";
import type { CreateTaskDialogProps } from "./interface";

type TaskFieldErrors = { projectId?: string; title?: string; deadline?: string };

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
  const { profile, user } = useAuth();
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
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const projectRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

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
      setFieldErrors({});
      setHasSubmitted(false);
    }
  }, [open, defaultProjectId, defaultStatus]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    setHasSubmitted(true);
    const nextErrors: TaskFieldErrors = {};
    if (!form.projectId) nextErrors.projectId = "Choose the project this task belongs to.";
    if (!form.title.trim()) nextErrors.title = "Enter a title for this task.";
    else if (form.title.trim().length < 3)
      nextErrors.title = "Use at least 3 characters for the title.";
    if (!form.deadline) nextErrors.deadline = "Choose a due date to track this task.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(null);
      if (nextErrors.projectId) projectRef.current?.focus();
      else if (nextErrors.title) titleRef.current?.focus();
      else deadlineRef.current?.focus();
      return;
    }
    setFieldErrors({});
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
          setHasSubmitted(false);
          setFieldErrors({});
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Assign work to a developer with a clear deadline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-project">
              Project{" "}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </Label>
            <Select
              value={form.projectId}
              onValueChange={(value) => {
                setForm((prev) => ({ ...prev, projectId: value, developerId: "" }));
                setFieldErrors((prev) => ({ ...prev, projectId: "" }));
                setError(null);
              }}
            >
              <SelectTrigger
                id="task-project"
                ref={projectRef}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.projectId)}
                aria-describedby={fieldErrors.projectId ? "task-project-error" : undefined}
              >
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
            {fieldErrors.projectId ? (
              <p id="task-project-error" className="text-xs text-danger">
                {fieldErrors.projectId}
              </p>
            ) : null}
          </div>
          <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1.7fr)_minmax(15rem,1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title" className="text-base">
                  Task title{" "}
                  <span aria-hidden="true" className="text-danger">
                    *
                  </span>
                </Label>
                <Input
                  id="task-title"
                  ref={titleRef}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.title)}
                  aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
                  className="h-11 text-base sm:text-lg"
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({ ...prev, title }));
                    if (hasSubmitted) {
                      const message = !title.trim()
                        ? "Enter a title for this task."
                        : title.trim().length < 3
                          ? "Use at least 3 characters for the title."
                          : "";
                      setFieldErrors((prev) => ({ ...prev, title: message }));
                    }
                    setError(null);
                  }}
                  placeholder="e.g. Add sign-in with passkeys"
                />
                {fieldErrors.title ? (
                  <p id="task-title-error" className="text-xs text-danger">
                    {fieldErrors.title}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  rows={8}
                  className="min-h-48 resize-y"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add the context, expected outcome, or implementation details…"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label id="task-creator-label">Created by</Label>
                <div
                  className="flex h-10 items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-sm sm:text-base"
                  aria-labelledby="task-creator-label"
                >
                  <UserAvatar name={profile?.name ?? user?.name ?? "User"} size="sm" />
                  <span className="truncate font-medium">
                    {profile?.name ?? user?.name ?? "Signed-in user"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assignee</Label>
                <Select
                  disabled={!form.projectId || isDevelopersLoading}
                  value={form.developerId || "unassigned"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      developerId: value === "unassigned" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id="task-assignee" className="text-sm sm:text-base">
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
                        <span className="flex items-center gap-2.5">
                          <UserAvatar name={dev.name} size="sm" />
                          <span>{dev.name}</span>
                        </span>
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
              <div className="space-y-2">
                <Label htmlFor="task-status">Task status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as TaskWorkflowStatus }))
                  }
                >
                  <SelectTrigger id="task-status">
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
              <div className="space-y-2">
                <Label htmlFor="task-deadline">
                  Due date{" "}
                  <span aria-hidden="true" className="text-danger">
                    *
                  </span>
                </Label>
                <Input
                  id="task-deadline"
                  ref={deadlineRef}
                  type="date"
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.deadline)}
                  aria-describedby={fieldErrors.deadline ? "task-deadline-error" : undefined}
                  value={form.deadline}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, deadline: e.target.value }));
                    if (hasSubmitted)
                      setFieldErrors((prev) => ({
                        ...prev,
                        deadline: e.target.value ? "" : "Choose a due date to track this task.",
                      }));
                    setError(null);
                  }}
                />
                {fieldErrors.deadline ? (
                  <p id="task-deadline-error" className="text-xs text-danger">
                    {fieldErrors.deadline}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm({ ...form, priority: value as Priority })}
                >
                  <SelectTrigger id="task-priority">
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
            </div>
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
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
