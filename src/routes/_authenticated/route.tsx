import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api, getAuthToken } from "@/lib/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async () => {
    const token = getAuthToken();
    if (!token) throw redirect({ to: "/login" });
    try {
      const user = await api.getMe();
      if (!user) throw redirect({ to: "/login" });
      return { user };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
