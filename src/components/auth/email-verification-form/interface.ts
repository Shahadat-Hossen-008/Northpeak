import type { AppRole, AuthUser } from "@/types";

export interface EmailVerificationFormProps {
  email: string;
  role?: AppRole | undefined;
  codeExpiresInSeconds?: number | undefined;
  notice?: string | null | undefined;
  onSuccess?: (user: AuthUser) => void;
  onBack?: () => void;
  className?: string;
}
