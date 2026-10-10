import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getAuthToken, setAuthToken } from "@/lib/api";

export type AppRole = "manager" | "developer";

export type Profile = {
  id: string;
  name: string;
  email: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

type AuthValue = {
  user: AuthUser | null;
  session: { access_token: string } | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  reload: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      if (data?.id) {
        setUser({
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role as AppRole,
        });
      } else {
        setAuthToken(null);
        setUser(null);
      }
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const reload = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const profile = useMemo<Profile | null>(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }, [user]);

  const role = user?.role ?? null;
  const session = useMemo(() => {
    if (!user) return null;
    const token = getAuthToken();
    return token ? { access_token: token } : null;
  }, [user]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      session,
      profile,
      role,
      loading,
      reload,
      logout,
    }),
    [user, session, profile, role, loading, reload, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homePathForRole(role: AppRole | null): string {
  return role === "developer" ? "/developer/dashboard" : "/manager/dashboard";
}
