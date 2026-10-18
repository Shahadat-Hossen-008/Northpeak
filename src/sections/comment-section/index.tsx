import { Check, Pencil, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/dialogs";
import { UserAvatar } from "@/components/avatar";
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useMembers,
  useUpdateComment,
} from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/deadline";
import type { CommentSectionProps } from "./interface";

export function CommentSection({ taskId, projectId, actorId }: CommentSectionProps) {
  const { user } = useAuth();
  const { data, isLoading } = useComments(taskId);
  const { data: members } = useMembers();
  const addComment = useAddComment(taskId, actorId, projectId);
  const deleteComment = useDeleteComment(taskId);
  const updateComment = useUpdateComment(taskId);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const roleFor = (id?: string) =>
    members?.find((m) => m.id === id)?.role === "manager" ? "Project manager" : "Developer";

  const comments = data ?? [];

  return (
    <div className="space-y-5">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No comments yet. Share the first update.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const canDelete = user?.id === comment.author?.id || user?.role === "manager";
            const canEdit = user?.id === comment.author?.id;
            const wasEdited = Boolean(
              comment.updated_at &&
              new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime(),
            );
            return (
              <li key={comment.id} className="group flex gap-3">
                <UserAvatar name={comment.author?.name ?? "Unknown"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm sm:text-base font-semibold">
                        {comment.author?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {roleFor(comment.author?.id)}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        · {timeAgo(comment.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit comment"
                          title="Edit comment"
                          onClick={() => setEditing({ id: comment.id, body: comment.body })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete comment"
                          title="Delete comment"
                          className="text-muted-foreground hover:text-danger hover:bg-danger-soft/40 size-7 cursor-pointer"
                          onClick={() => setDeletingId(comment.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {editing?.id === comment.id ? (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const value = editing.body.trim();
                        if (!value) return;
                        updateComment.mutate(
                          { id: comment.id, body: value },
                          { onSuccess: () => setEditing(null) },
                        );
                      }}
                    >
                      <Textarea
                        value={editing.body}
                        onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                        rows={3}
                        autoFocus
                        aria-label="Edit comment"
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="size-4" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={!editing.body.trim() || updateComment.isPending}
                          loading={updateComment.isPending}
                        >
                          <Check className="size-4" />
                          Save
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-1.5 text-sm sm:text-base leading-relaxed whitespace-pre-line text-foreground">
                      {comment.body}
                    </p>
                  )}
                  {wasEdited ? (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  ) : null}
                </div>
                <ConfirmActionDialog
                  open={deletingId === comment.id}
                  onOpenChange={(open) => !open && setDeletingId(null)}
                  title="Delete this comment?"
                  description="This comment will be permanently deleted. This action cannot be undone."
                  confirmLabel="Delete comment"
                  pending={deleteComment.isPending}
                  onConfirm={async () => {
                    await deleteComment.mutateAsync(comment.id);
                  }}
                >
                  <span />
                </ConfirmActionDialog>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = body.trim();
          if (!value) return;
          addComment.mutate(value, { onSuccess: () => setBody("") });
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write an update…"
          rows={3}
          aria-label="Write a comment"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!body.trim() || addComment.isPending}
            loading={addComment.isPending}
          >
            <Send className="size-4" />
            {addComment.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CommentSection;
export type { CommentSectionProps } from "./interface";
