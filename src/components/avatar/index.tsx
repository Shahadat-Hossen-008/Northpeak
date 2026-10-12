import { cn } from "@/lib/utils";
import { initials } from "@/lib/deadline";
import type { UserAvatarProps } from "./interface";

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) | 0;
  return out;
}

export function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  const dims =
    size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  // Deterministic tint from the name so avatars stay stable across renders.
  const tints = [
    "bg-primary-soft text-primary",
    "bg-info-soft text-info",
    "bg-success-soft text-success",
    "bg-warning-soft text-warning-foreground",
    "bg-accent text-accent-foreground",
  ];
  const tint = tints[Math.abs(hash(name)) % tints.length]!;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dims,
        tint,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export default UserAvatar;
export type { UserAvatarProps, AvatarSize } from "./interface";
