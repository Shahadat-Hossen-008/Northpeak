import { AlertTriangle, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { ConfirmActionDialog } from "../confirm-action-dialog";
import { useMembers, useTasks, useUpdateProject } from "@/hooks/queries";
import type { Priority, Project } from "@/types";
import { ProjectTeamSelector } from "../team-selector";
import { PRIORITIES, toInputDate, toIso } from "../utils";
import type { EditProjectDialogProps } from "./interface";

export function EditProjectDialog({ project, trigger }: EditProjectDialogProps) {
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
  const [confirmTeamRemoval, setConfirmTeamRemoval] = useState(false);

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

  async function saveProject() {
    setError(null);
    const data = (await update.mutateAsync({
      id: project.id,
      title: form.title.trim(),
      description: form.description.trim(),
      start_date: form.start || null,
      deadline: toIso(form.deadline),
      priority: form.priority,
      team: form.team,
    })) as Project & { unassigned_open_tasks_count?: number };
    setOpen(false);
    if (data?.unassigned_open_tasks_count && data.unassigned_open_tasks_count > 0) {
      toast.info(
        `Unassigned ${data.unassigned_open_tasks_count} open task(s) from removed team member(s).`,
      );
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      setError("Project name must be at least 3 characters.");
      return;
    }
    if (removedDevelopersWithOpenTasks.length > 0) {
      setConfirmTeamRemoval(true);
      return;
    }
    void saveProject();
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
          <div className="space-y-3">
            <Label htmlFor="edit-project-title">Project name</Label>
            <Input
              id="edit-project-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-3">
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
            <div className="space-y-3">
              <Label htmlFor="edit-project-start">Start date</Label>
              <Input
                id="edit-project-start"
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="edit-project-deadline">Deadline</Label>
              <Input
                id="edit-project-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label htmlFor="edit-project-priority">Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(val) => setForm({ ...form, priority: val as Priority })}
            >
              <SelectTrigger id="edit-project-priority">
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
        <ConfirmActionDialog
          open={confirmTeamRemoval}
          onOpenChange={setConfirmTeamRemoval}
          title="Remove team members with open work?"
          description={
            <>
              Removing these developers will unassign{" "}
              {removedDevelopersWithOpenTasks.reduce(
                (sum, developer) => sum + developer.openTaskCount,
                0,
              )}{" "}
              open task(s). Completed tasks and task history will remain preserved.
            </>
          }
          confirmLabel="Remove and save"
          pending={update.isPending}
          onConfirm={saveProject}
        />
      </DialogContent>
    </Dialog>
  );
}

export default EditProjectDialog;
export type { EditProjectDialogProps } from "./interface";
