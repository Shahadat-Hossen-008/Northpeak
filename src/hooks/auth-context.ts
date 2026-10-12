import { createContext, useContext } from "react";
import type { AppRole, AuthUser, Profile } from "@/types";

export interface AuthValue {
  user: AuthUser | null;
  session: { access_token: string } | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  reload: async () => {},
  logout: () => {},
});

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
