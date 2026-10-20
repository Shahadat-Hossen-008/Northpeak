import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoadingState } from "@/components/feedback/loading-state";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => {
    const page = meta("Welcome", "Setting up your workspace.", "/welcome");
    return { ...page, meta: [...page.meta, { name: "robots", content: "noindex, nofollow" }] };
  },
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    void navigate({ to: homePathForRole(role), replace: true });
  }, [loading, user, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingState label="Preparing your workspace…" />
    </div>
  );
}
