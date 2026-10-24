import { Plus } from "lucide-react";
import { useRef, useState } from "react";
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
import { useCreateProject } from "@/hooks/queries";
import type { Priority } from "@/types";
import { ProjectTeamSelector } from "../team-selector";
import { PRIORITIES, toIso } from "../utils";
import type { CreateProjectDialogProps } from "./interface";

type ProjectFieldErrors = { title?: string; deadline?: string };

export function CreateProjectDialog({ actorId }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const create = useCreateProject(actorId);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start: "",
    deadline: "",
    priority: "medium" as Priority,
    team: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProjectFieldErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const nextErrors: ProjectFieldErrors = {};
    if (!form.title.trim()) nextErrors.title = "Enter a name for this project.";
    else if (form.title.trim().length < 3) {
      nextErrors.title = "Use at least 3 characters for the project name.";
    }
    if (form.start && form.deadline && new Date(form.deadline) < new Date(form.start)) {
      nextErrors.deadline = "Choose a deadline on or after the start date.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError(null);
      if (nextErrors.title) titleRef.current?.focus();
      else if (nextErrors.deadline) deadlineRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setError(null);
    create.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: form.start || null,
        deadline: toIso(form.deadline),
        priority: form.priority,
        team: form.team,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setFieldErrors({});
          setForm({
            title: "",
            description: "",
            start: "",
            deadline: "",
            priority: "medium",
            team: [],
          });
        },
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not create the project. Try again.");
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setFieldErrors({});
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Set the scope, dates and priority for the work.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="project-title">
              Project name{" "}
              <span aria-hidden="true" className="text-danger">
                *
              </span>
            </Label>
            <Input
              id="project-title"
              ref={titleRef}
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "project-title-error" : undefined}
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((prev) => ({ ...prev, title }));
                setFieldErrors((prev) => {
                  if (!prev.title) return prev;
                  const nextErrors = { ...prev };
                  delete nextErrors.title;
                  return nextErrors;
                });
                setError(null);
              }}
              placeholder="E-Commerce Platform"
            />
            {fieldErrors.title ? (
              <p id="project-title-error" className="text-xs text-danger">
                {fieldErrors.title}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this project delivering?"
            />
          </div>

          <ProjectTeamSelector
            selectedIds={form.team}
            onChange={(team) => setForm((prev) => ({ ...prev, team }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={form.start}
                onChange={(e) => {
                  const start = e.target.value;
                  setForm((prev) => ({ ...prev, start }));
                  setFieldErrors((prev) => {
                    if (!prev.deadline) return prev;
                    const nextErrors = { ...prev };
                    delete nextErrors.deadline;
                    return nextErrors;
                  });
                }}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="project-deadline">Deadline</Label>
              <Input
                id="project-deadline"
                ref={deadlineRef}
                type="date"
                aria-invalid={Boolean(fieldErrors.deadline)}
                aria-describedby={fieldErrors.deadline ? "project-deadline-error" : undefined}
                value={form.deadline}
                onChange={(e) => {
                  const deadline = e.target.value;
                  setForm((prev) => ({ ...prev, deadline }));
                  setFieldErrors((prev) => {
                    if (!prev.deadline) return prev;
                    const nextErrors = { ...prev };
                    delete nextErrors.deadline;
                    return nextErrors;
                  });
                }}
              />
              {fieldErrors.deadline ? (
                <p id="project-deadline-error" className="text-xs text-danger">
                  {fieldErrors.deadline}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="project-priority">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(value) => setForm({ ...form, priority: value as Priority })}
            >
              <SelectTrigger id="project-priority">
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
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectDialog;
export type { CreateProjectDialogProps } from "./interface";
