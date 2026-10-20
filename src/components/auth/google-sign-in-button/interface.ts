import type { AppRole } from "@/types";

export interface GoogleSignInButtonProps {
  role?: AppRole;
  onSuccess: (userRole: AppRole) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}
