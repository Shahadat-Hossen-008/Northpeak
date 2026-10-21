import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthToken } from "@/lib/api";
import { currentUserQueryOptions } from "@/hooks/queries/current-user";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: async ({ context }) => {
    const token = getAuthToken();
    if (!token) throw redirect({ to: "/login" });
    try {
      const user = await context.queryClient.fetchQuery(currentUserQueryOptions());
      if (!user) throw redirect({ to: "/login" });
      return { user };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
