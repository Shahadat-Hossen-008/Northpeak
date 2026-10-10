import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
import { WORKFLOW_COLUMNS } from "@/components/tasks";
import {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Member,
  type Priority,
  type Project,
  type Task,
  type TaskWorkflowStatus,
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
  defaultStatus = "todo",
  trigger,
}: {
  actorId: string | null;
  projects: Project[];
  developers: Member[];
  defaultProjectId?: string | undefined;
  defaultStatus?: TaskWorkflowStatus | undefined;
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
    status: (defaultStatus ?? "todo") as TaskWorkflowStatus,
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
                value={form.developerId || "unassigned"}
                onValueChange={(value) =>
                  setForm({ ...form, developerId: value === "unassigned" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
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
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toInputDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.split("T")[0] || "";
}

export function EditProjectDialog({ project, trigger }: { project: Project; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateProject();
  const [form, setForm] = useState({
    title: project.title,
    description: project.description,
    start: toInputDate(project.start_date),
    deadline: toInputDate(project.deadline),
    priority: project.priority,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: project.title,
        description: project.description,
        start: toInputDate(project.start_date),
        deadline: toInputDate(project.deadline),
        priority: project.priority,
      });
      setError(null);
    }
  }, [open, project]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Project name must be at least 3 characters.");
      return;
    }
    setError(null);
    update.mutate(
      {
        id: project.id,
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: form.start || null,
        deadline: toIso(form.deadline),
        priority: form.priority,
      },
      {
        onSuccess: () => setOpen(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update the scope, timeline, or priority.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-title">Project name</Label>
            <Input
              id="edit-project-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-desc">Description</Label>
            <Textarea
              id="edit-project-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-project-start">Start date</Label>
              <Input
                id="edit-project-start"
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-project-deadline">Deadline</Label>
              <Input
                id="edit-project-deadline"
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
              onValueChange={(val) => setForm({ ...form, priority: val as Priority })}
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
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProjectDialog({
  project,
  trigger,
  onDeleted,
}: {
  project: Project;
  trigger?: ReactNode;
  onDeleted?: () => void;
}) {
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
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
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

export function EditTaskDialog({
  task,
  developers,
  trigger,
}: {
  task: Task;
  developers: Member[];
  trigger?: ReactNode;
}) {
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
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input
              id="edit-task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-desc">Description</Label>
            <Textarea
              id="edit-task-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Assigned developer</Label>
              <Select
                value={form.developerId || "unassigned"}
                onValueChange={(val) => setForm({ ...form, developerId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {developers.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => setForm({ ...form, priority: val as Priority })}
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
                onValueChange={(val) => setForm({ ...form, status: val as TaskWorkflowStatus })}
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
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTaskDialog({
  task,
  trigger,
  onDeleted,
}: {
  task: Task;
  trigger?: ReactNode;
  onDeleted?: () => void;
}) {
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
          <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
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
