import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/progress/progress-bar";
import { useSubtaskMutations, useSubtasks, type Subtask } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { SubtaskListProps } from "./interface";

export function SubtaskList({ taskId, projectId, actorId, canEdit }: SubtaskListProps) {
  const { data, isLoading } = useSubtasks(taskId);
  const mutations = useSubtaskMutations(taskId, actorId, projectId);
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const subtasks: Subtask[] = data ?? [];
  const done = subtasks.filter((s) => s.is_completed).length;
  const progress = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2.5 flex items-center justify-between text-sm sm:text-base">
          <span className="font-semibold">Subtasks</span>
          <span className="tabular text-xs sm:text-sm text-muted-foreground font-medium">
            {done} / {subtasks.length} completed
          </span>
        </div>
        <ProgressBar value={progress} tone={progress === 100 ? "success" : "primary"} />
      </div>

      {isLoading ? (
        <p className="text-sm sm:text-base text-muted-foreground">Loading subtasks…</p>
      ) : subtasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm sm:text-base text-muted-foreground">
          No subtasks yet. Break this task into smaller steps.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {subtasks.map((subtask) => (
            <li
              key={subtask.id}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-secondary transition-colors"
            >
              <Checkbox
                checked={subtask.is_completed}
                disabled={!canEdit || mutations.toggle.isPending}
                aria-label={`Mark ${subtask.title} ${subtask.is_completed ? "incomplete" : "complete"}`}
                onCheckedChange={() => mutations.toggle.mutate(subtask)}
              />
              {editing?.id === subtask.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editing.title.trim()) {
                      mutations.rename.mutate({ id: subtask.id, title: editing.title.trim() });
                    }
                    setEditing(null);
                  }}
                >
                  <Input
                    value={editing.title}
                    onChange={(e) => setEditing({ id: subtask.id, title: e.target.value })}
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Save subtask"
                    title="Save"
                  >
                    <Check className="size-4 text-success" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Cancel edit"
                    title="Cancel"
                    onClick={() => setEditing(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <span
                    className={cn(
                      "flex-1 text-sm sm:text-base",
                      subtask.is_completed && "text-muted-foreground line-through",
                    )}
                  >
                    {subtask.title}
                  </span>
                  {canEdit ? (
                    <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${subtask.title}`}
                        title="Edit subtask"
                        onClick={() => setEditing({ id: subtask.id, title: subtask.title })}
                      >
                        <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${subtask.title}`}
                        title="Delete subtask"
                        className="hover:text-danger hover:bg-danger-soft/40 cursor-pointer"
                        onClick={() => mutations.remove.mutate(subtask.id)}
                      >
                        <Trash2 className="size-3.5 text-danger" />
                      </Button>
                    </span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const title = newTitle.trim();
            if (!title) return;
            mutations.add.mutate(title);
            setNewTitle("");
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a subtask…"
            aria-label="New subtask"
          />
          <Button
            type="submit"
            disabled={!newTitle.trim() || mutations.add.isPending}
            loading={mutations.add.isPending}
          >
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export default SubtaskList;
export type { SubtaskListProps } from "./interface";
