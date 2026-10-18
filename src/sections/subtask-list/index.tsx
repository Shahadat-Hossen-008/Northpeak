import { Check, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/dialogs";
import { UserAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar } from "@/components/progress/progress-bar";
import { useMembers, useSubtaskMutations, useSubtasks, type Subtask } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { SubtaskListProps } from "./interface";

const UNASSIGNED = "unassigned";

export function SubtaskList({ taskId, projectId, actorId, canEdit, canAssign }: SubtaskListProps) {
  const { data, isLoading } = useSubtasks(taskId);
  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
  } = useMembers(canAssign ? projectId : null);
  const mutations = useSubtaskMutations(taskId, actorId, projectId);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    description: string;
    assignee: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const subtasks: Subtask[] = data ?? [];
  const developers = (members ?? []).filter((member) => member.role === "developer");
  const done = subtasks.filter((subtask) => subtask.is_completed).length;
  const progress = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100);

  const assigneeOptions = (
    value: string,
    onChange: (next: string) => void,
    label: string,
    allowUnassigned = true,
  ) => (
    <Select value={value || (allowUnassigned ? UNASSIGNED : "")} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-9 min-w-0 text-sm">
        <SelectValue placeholder={allowUnassigned ? "Unassigned" : "Select a developer"} />
      </SelectTrigger>
      <SelectContent>
        {allowUnassigned ? (
          <SelectItem value={UNASSIGNED}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <UserRound className="size-4" />
              Unassigned
            </span>
          </SelectItem>
        ) : null}
        {developers.map((developer) => (
          <SelectItem key={developer.id} value={developer.id}>
            <span className="flex items-center gap-2">
              <UserAvatar name={developer.name} size="sm" className="size-5 text-[9px]" />
              {developer.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2.5 flex items-center justify-between text-sm sm:text-base">
          <span className="font-semibold">Subtasks</span>
          <span className="tabular text-xs font-medium text-muted-foreground sm:text-sm">
            {done} / {subtasks.length} completed
          </span>
        </div>
        <ProgressBar value={progress} tone={progress === 100 ? "success" : "primary"} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground sm:text-base">Loading subtasks…</p>
      ) : subtasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground sm:text-base">
          No subtasks yet. Break this task into smaller steps.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {subtasks.map((subtask) => {
            const isEditing = editing?.id === subtask.id;
            return (
              <li
                key={subtask.id}
                className="group min-w-0 rounded-xl border border-border/80 bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-secondary/40 sm:p-4"
              >
                {isEditing ? (
                  <form
                    className="space-y-2.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!editing.title.trim() || mutations.rename.isPending) return;
                      mutations.rename.mutate(
                        {
                          id: subtask.id,
                          title: editing.title.trim(),
                          description: editing.description.trim(),
                          ...(canAssign
                            ? {
                                assigned_developer_id:
                                  editing.assignee === UNASSIGNED ? null : editing.assignee,
                              }
                            : {}),
                        },
                        { onSuccess: () => setEditing(null) },
                      );
                    }}
                  >
                    <Input
                      value={editing.title}
                      onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                      autoFocus
                      aria-label="Subtask title"
                    />
                    <Textarea
                      value={editing.description}
                      onChange={(event) =>
                        setEditing({ ...editing, description: event.target.value })
                      }
                      placeholder="Subtask description"
                      rows={2}
                      aria-label="Subtask description"
                    />
                    {canAssign ? (
                      membersLoading ? (
                        <p className="text-sm text-muted-foreground">Loading developers…</p>
                      ) : membersError ? (
                        <p className="text-sm text-danger">Unable to load developers.</p>
                      ) : (
                        assigneeOptions(
                          editing.assignee,
                          (assignee) => setEditing({ ...editing, assignee }),
                          "Subtask assignee",
                        )
                      )
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="submit" size="sm" disabled={mutations.rename.isPending}>
                        <Check className="size-4" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                      >
                        <X className="size-4" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={subtask.is_completed}
                      disabled={!canEdit || mutations.toggle.isPending}
                      aria-label={`Mark ${subtask.title} ${subtask.is_completed ? "incomplete" : "complete"}`}
                      onCheckedChange={() => mutations.toggle.mutate(subtask)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "wrap-break-word text-sm font-semibold sm:text-base",
                          subtask.is_completed && "text-muted-foreground line-through",
                        )}
                      >
                        {subtask.title}
                      </p>
                      {subtask.description ? (
                        <p className="mt-1 line-clamp-3 wrap-break-word text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {subtask.description}
                        </p>
                      ) : null}
                      <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {subtask.assignee ? (
                          <>
                            <UserAvatar
                              name={subtask.assignee.name}
                              size="sm"
                              className="size-5 text-[9px]"
                            />
                            <span className="truncate">{subtask.assignee.name}</span>
                          </>
                        ) : (
                          <>
                            <UserRound className="size-3.5" />
                            <span>Unassigned</span>
                          </>
                        )}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${subtask.title}`}
                          title="Edit subtask"
                          onClick={() =>
                            setEditing({
                              id: subtask.id,
                              title: subtask.title,
                              description: subtask.description,
                              assignee: subtask.assigned_developer_id ?? UNASSIGNED,
                            })
                          }
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${subtask.title}`}
                          title="Delete subtask"
                          className="cursor-pointer hover:bg-danger-soft/40 hover:text-danger"
                          onClick={() => setDeletingId(subtask.id)}
                        >
                          <Trash2 className="size-3.5 text-danger" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
                <ConfirmActionDialog
                  open={deletingId === subtask.id}
                  onOpenChange={(open) => !open && setDeletingId(null)}
                  title={`Delete "${subtask.title}"?`}
                  description="This subtask will be permanently deleted. This action cannot be undone."
                  confirmLabel="Delete subtask"
                  pending={mutations.remove.isPending}
                  onConfirm={async () => {
                    await mutations.remove.mutateAsync(subtask.id);
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <form
          className="space-y-2.5 rounded-xl border border-border/80 p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const title = newTitle.trim();
            const description = newDescription.trim();
            const hasRequiredAssignee = !canAssign || Boolean(newAssignee);
            if (
              !title ||
              !description ||
              !hasRequiredAssignee ||
              (canAssign && developers.length === 0) ||
              mutations.add.isPending
            ) {
              return;
            }
            mutations.add.mutate(
              {
                title,
                description,
                ...(canAssign ? { assigned_developer_id: newAssignee } : {}),
              },
              {
                onSuccess: () => {
                  setNewTitle("");
                  setNewDescription("");
                  setNewAssignee("");
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-subtask-title">
              Title <span className="text-danger">*</span>
            </label>
            <Input
              id="new-subtask-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Enter a subtask title"
              aria-label="New subtask title"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-subtask-description">
              Description
            </label>
            <Textarea
              id="new-subtask-description"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Describe what needs to be done"
              aria-label="New subtask description"
              rows={2}
              required
            />
          </div>
          {canAssign ? (
            membersLoading ? (
              <p className="text-sm text-muted-foreground">Loading developers…</p>
            ) : membersError ? (
              <p className="text-sm text-danger">Unable to load developers.</p>
            ) : developers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No eligible developers are available for assignment.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="new-subtask-assignee">
                  Assignee
                </label>
                {assigneeOptions(newAssignee, setNewAssignee, "Select a developer", false)}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              Assignee is managed by the project manager. This subtask will be unassigned.
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                !newTitle.trim() ||
                !newDescription.trim() ||
                (canAssign && (!newAssignee || developers.length === 0)) ||
                mutations.add.isPending
              }
              loading={mutations.add.isPending}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default SubtaskList;
export type { SubtaskListProps } from "./interface";
