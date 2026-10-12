export type AvatarSize = "sm" | "md" | "lg";

export interface UserAvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}
