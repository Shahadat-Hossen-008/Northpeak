import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

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
import {
  useCreateProject,
  useCreateTask,
  type Member,
  type Priority,
  type Project,
} from "@/hooks/queries";

const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

function toIso(date: string): string | null {
  if (!date) return null;
  // Stored in UTC; the date input is local calendar day at end of day.
  return new Date(`${date}T23:59:59`).toISOString();
}

export function CreateProjectDialog({ actorId }: { actorId: string | null }) {
  const [open, setOpen] = useState(false);
  const create = useCreateProject(actorId);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start: "",
    deadline: "",
    priority: "medium" as Priority,
  });
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Project name must be at least 3 characters.");
      return;
    }
    if (form.start && form.deadline && new Date(form.deadline) < new Date(form.start)) {
      setError("Deadline must be after the start date.");
      return;
    }
    setError(null);
    create.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: form.start || null,
        deadline: toIso(form.deadline),
        priority: form.priority,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ title: "", description: "", start: "", deadline: "", priority: "medium" });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Set the scope, dates and priority for the work.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-title">Project name</Label>
            <Input
              id="project-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="E-Commerce Platform"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this project delivering?"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-deadline">Deadline</Label>
              <Input
                id="project-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog({
  actorId,
  projects,
  developers,
  defaultProjectId,
  trigger,
}: {
  actorId: string | null;
  projects: Project[];
  developers: Member[];
  defaultProjectId?: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const create = useCreateTask(actorId);
  const [form, setForm] = useState({
    projectId: defaultProjectId ?? "",
    title: "",
    description: "",
    developerId: "",
    deadline: "",
    priority: "medium" as Priority,
  });
  const [error, setError] = useState<string | null>(null);

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
        assigned_developer_id: form.developerId || null,
        deadline: toIso(form.deadline),
        priority: form.priority,
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
          });
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
              onValueChange={(value) => setForm({ ...form, projectId: value })}
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
                value={form.developerId}
                onValueChange={(value) => setForm({ ...form, developerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  {developers.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.name}
                    </SelectItem>
                  ))}
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
