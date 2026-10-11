import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/primitives";
import { cn } from "@/lib/utils";
import { WORKFLOW_COLUMNS } from "@/components/tasks";
import {
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMembers,
  useTasks,
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

function ProjectTeamSelector({
  selectedIds,
  onChange,
  disabled = false,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { data: members, isLoading } = useMembers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const developers = useMemo(() => {
    return (members ?? []).filter((m) => m.role === "developer");
  }, [members]);

  const filteredDevelopers = useMemo(() => {
    if (!search.trim()) return developers;
    const q = search.toLowerCase().trim();
    return developers.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.email && d.email.toLowerCase().includes(q)),
    );
  }, [developers, search]);

  const selectedDevelopers = useMemo(() => {
    return developers.filter((d) => selectedIds.includes(d.id));
  }, [developers, selectedIds]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Assigned Engineering Team</Label>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length} {selectedIds.length === 1 ? "developer" : "developers"} assigned
        </span>
      </div>

      {/* Selected tags */}
      {selectedDevelopers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-muted/40 border border-border/60">
          {selectedDevelopers.map((dev) => (
            <span
              key={dev.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground border border-border shadow-xs"
            >
              <UserAvatar name={dev.name} size="sm" className="size-4 text-[9px]" />
              <span className="truncate max-w-[120px]">{dev.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => remove(dev.id, e)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none cursor-pointer"
                aria-label={`Remove ${dev.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Popover trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between font-normal text-left h-auto py-2"
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <Users className="size-4 text-muted-foreground shrink-0" />
              {isLoading ? (
                "Loading developers…"
              ) : selectedIds.length === 0 ? (
                <span className="text-muted-foreground">Assign developers to project team…</span>
              ) : (
                <span>Add / manage team members…</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-2" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Search by name or email…"
                className="w-full bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1">
              {filteredDevelopers.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {search ? "No matching developers found" : "No registered developers"}
                </p>
              ) : (
                filteredDevelopers.map((dev) => {
                  const isSelected = selectedIds.includes(dev.id);
                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => toggle(dev.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/80 cursor-pointer",
                        isSelected && "bg-muted/50 font-medium",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar name={dev.name} size="sm" className="size-6 text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{dev.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{dev.email}</p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {isSelected && <Check className="size-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
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
    team: [] as string[],
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
        team: form.team,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({
            title: "",
            description: "",
            start: "",
            deadline: "",
            priority: "medium",
            team: [],
          });
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

          <ProjectTeamSelector
            selectedIds={form.team}
            onChange={(team) => setForm((prev) => ({ ...prev, team }))}
          />

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
            <Button type="submit" disabled={create.isPending} loading={create.isPending}>
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
  developers: propDevelopers,
  defaultProjectId,
  defaultStatus = "todo",
  trigger,
}: {
  actorId: string | null;
  projects: Project[];
  developers?: Member[];
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

function toInputDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.split("T")[0] || "";
}

export function EditProjectDialog({ project, trigger }: { project: Project; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateProject();
  const tasksQuery = useTasks();
  const membersQuery = useMembers();

  const [form, setForm] = useState({
    title: project.title,
    description: project.description,
    start: toInputDate(project.start_date),
    deadline: toInputDate(project.deadline),
    priority: project.priority,
    team: (project.team ?? []) as string[],
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
        team: (project.team ?? []) as string[],
      });
      setError(null);
    }
  }, [open, project]);

  const originalTeam = useMemo(() => {
    return project.team ?? [];
  }, [project.team]);

  const removedDevelopersWithOpenTasks = useMemo(() => {
    const removedIds = originalTeam.filter((id) => !form.team.includes(id));
    if (removedIds.length === 0) return [];

    const projectTasks = (tasksQuery.data ?? []).filter((t) => t.project_id === project.id);
    return removedIds
      .map((devId) => {
        const dev = (membersQuery.data ?? []).find((m) => m.id === devId);
        const openCount = projectTasks.filter(
          (t) => t.assigned_developer_id === devId && !t.is_completed,
        ).length;
        return {
          id: devId,
          name: dev?.name || "Developer",
          openTaskCount: openCount,
        };
      })
      .filter((d) => d.openTaskCount > 0);
  }, [originalTeam, form.team, tasksQuery.data, membersQuery.data, project.id]);

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
        team: form.team,
      },
      {
        onSuccess: (data: { unassigned_open_tasks_count?: number }) => {
          setOpen(false);
          if (data?.unassigned_open_tasks_count && data.unassigned_open_tasks_count > 0) {
            toast.info(
              `Unassigned ${data.unassigned_open_tasks_count} open task(s) from removed team member(s).`,
            );
          }
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
            Edit project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update the scope, timeline, priority, or engineering team.
          </DialogDescription>
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

          <ProjectTeamSelector
            selectedIds={form.team}
            onChange={(team) => setForm((prev) => ({ ...prev, team }))}
          />

          {removedDevelopersWithOpenTasks.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    Team removal will unassign open tasks
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {removedDevelopersWithOpenTasks.map((d) => (
                      <p key={d.id}>
                        Removing <strong>{d.name}</strong> will unassign {d.openTaskCount} open task
                        {d.openTaskCount > 1 ? "s" : ""}.
                      </p>
                    ))}
                    <p className="text-[11px] text-muted-foreground dark:text-amber-300/80 pt-0.5">
                      Completed tasks and task history will remain preserved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
            <Button type="submit" disabled={update.isPending} loading={update.isPending}>
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

export function EditTaskDialog({
  task,
  developers: propDevelopers,
  trigger,
}: {
  task: Task;
  developers?: Member[];
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
                disabled={isDevelopersLoading}
                value={form.developerId || "unassigned"}
                onValueChange={(val) => setForm({ ...form, developerId: val })}
              >
                <SelectTrigger>
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
            <Button type="submit" disabled={update.isPending} loading={update.isPending}>
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
