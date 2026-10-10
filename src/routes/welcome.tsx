import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoadingState } from "@/components/primitives";
import { homePathForRole, useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome — Northpeak" },
      { name: "description", content: "Setting up your workspace." },
    ],
  }),
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
