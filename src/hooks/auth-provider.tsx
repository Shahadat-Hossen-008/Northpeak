import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuthToken, setAuthToken } from "@/lib/api";
import { currentUserQueryKey, currentUserQueryOptions } from "@/hooks/queries/current-user";
import type { AppRole, AuthUser, Profile } from "@/types";
import { AuthContext, type AuthValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(
    async (forceRefresh = false) => {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        queryClient.removeQueries({ queryKey: currentUserQueryKey });
        setLoading(false);
        return;
      }

      try {
        const data = await queryClient.fetchQuery({
          ...currentUserQueryOptions(),
          ...(forceRefresh ? { staleTime: 0 } : {}),
        });
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
          queryClient.removeQueries({ queryKey: currentUserQueryKey });
        }
      } catch {
        setAuthToken(null);
        setUser(null);
        queryClient.removeQueries({ queryKey: currentUserQueryKey });
      } finally {
        setLoading(false);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const reload = useCallback(async () => {
    await loadUser(true);
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

export default AuthProvider;
