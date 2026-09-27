import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/primitives";
import { useAddComment, useComments, useMembers } from "@/hooks/queries";
import { timeAgo } from "@/lib/deadline";

export function CommentSection({
  taskId,
  projectId,
  actorId,
}: {
  taskId: string;
  projectId: string;
  actorId: string | null;
}) {
  const { data, isLoading } = useComments(taskId);
  const { data: members } = useMembers();
  const addComment = useAddComment(taskId, actorId, projectId);
  const [body, setBody] = useState("");

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
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar name={comment.author?.name ?? "Unknown"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{comment.author?.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">
                    {roleFor(comment.author?.id)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {timeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm whitespace-pre-line text-foreground">{comment.body}</p>
              </div>
            </li>
          ))}
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
          <Button type="submit" disabled={!body.trim() || addComment.isPending}>
            <Send className="size-4" />
            {addComment.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
