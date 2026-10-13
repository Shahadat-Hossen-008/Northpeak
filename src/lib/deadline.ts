export type DeadlineState =
  "completed_on_time" | "completed_late" | "overdue" | "due_soon" | "on_track" | "no_deadline";

export const DUE_SOON_DAYS = 3;

const DAY_MS = 86_400_000;

export type DeadlineInput = {
  deadline: string | null;
  isCompleted: boolean;
  completedAt: string | null;
};

export function deadlineState(
  { deadline, isCompleted, completedAt }: DeadlineInput,
  now: Date = new Date(),
): DeadlineState {
  const currentDate = now instanceof Date ? now : new Date();
  if (isCompleted) {
    if (!deadline) return "completed_on_time";
    const done = completedAt ? new Date(completedAt) : currentDate;
    return done.getTime() > new Date(deadline).getTime() ? "completed_late" : "completed_on_time";
  }
  if (!deadline) return "no_deadline";
  const diff = new Date(deadline).getTime() - currentDate.getTime();
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_DAYS * DAY_MS) return "due_soon";
  return "on_track";
}

export const DEADLINE_LABEL: Record<DeadlineState, string> = {
  completed_on_time: "Completed on time",
  completed_late: "Completed late",
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
  no_deadline: "No deadline",
};

/** Human readable relative deadline, e.g. "Due in 4 days", "2 days overdue". */
export function deadlineText(deadline: string | null, now: Date = new Date()): string {
  if (!deadline) return "No deadline";
  const target = new Date(deadline);
  const diff = target.getTime() - now.getTime();
  const days = Math.round(diff / DAY_MS);

  if (diff < 0) {
    const overdueDays = Math.abs(days);
    if (overdueDays === 0) return "Overdue today";
    if (overdueDays === 1) return "1 day overdue";
    return `${overdueDays} days overdue`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 30) return `Due in ${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "Due in about a month" : `Due in ${months} months`;
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
