import { request, setAuthToken } from "./client";
import type { AuthUser } from "@/types";

export const authApi = {
  async login(credentials: { email: string; password: string }) {
    const data = await request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAuthToken(data.token);
    return data;
  },

  async register(payload: { name: string; email: string; password: string; role: string }) {
    return request<{
      requiresEmailVerification: true;
      email: string;
      codeExpiresInSeconds: number;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async verifyEmail(payload: { email: string; code: string }) {
    const data = await request<{ token: string; user: AuthUser }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthToken(data.token);
    return data;
  },

  async resendVerification(email: string) {
    // Calls the backend resend endpoint; delivery and cooldown checks stay server-side.
    return request<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async googleSignIn(credential: string, role?: string) {
    const data = await request<{ token: string; user: AuthUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, role }),
    });
    setAuthToken(data.token);
    return data;
  },

  async getMe() {
    return request<AuthUser>("/auth/me");
  },

  async updateProfile(payload: { name?: string; password?: string }) {
    return request<AuthUser>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  logout() {
    setAuthToken(null);
  },
};
