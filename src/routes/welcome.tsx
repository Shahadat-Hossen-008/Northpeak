import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/primitives";
import { homePathForRole, useAuth, type AppRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finish setup — Northpeak" },
      { name: "description", content: "Choose your role to finish setting up your workspace." },
      { property: "og:title", content: "Finish setup — Northpeak" },
      {
        property: "og:description",
        content: "Choose your role to finish setting up your workspace.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const { user, role, loading, reload } = useAuth();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoClaimed = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (role) {
      void navigate({ to: homePathForRole(role), replace: true });
      return;
    }
    setName(
      (user.user_metadata?.["name"] as string | undefined) ??
        (user.user_metadata?.["full_name"] as string | undefined) ??
        "",
    );
    const metaRole = user.user_metadata?.["role"] as AppRole | undefined;
    if (metaRole && !autoClaimed.current) {
      autoClaimed.current = true;
      void claim(metaRole);
    }
  }, [loading, user, role, navigate]);

  async function claim(selected: AppRole) {
    if (!user) return;
    setSubmitting(true);
    const displayName =
      name.trim() ||
      (user.user_metadata?.["full_name"] as string | undefined) ||
      user.email?.split("@")[0] ||
      "Member";
    const { error } = await supabase.rpc("claim_account", {
      _name: displayName,
      _email: user.email ?? null,
      _role: selected,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await reload();
    void navigate({ to: homePathForRole(selected), replace: true });
  }

  if (loading || !user) return <LoadingState label="Preparing your workspace…" />;

  return (
    <AuthLayout title="Almost there" subtitle="Tell us how you'll use Northpeak.">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button disabled={submitting} onClick={() => claim("manager")} className="h-auto py-4">
            <span className="block text-left">
              <span className="block text-sm font-semibold">Project manager</span>
              <span className="block text-xs opacity-80">Create projects, assign work</span>
            </span>
          </Button>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => claim("developer")}
            className="h-auto py-4"
          >
            <span className="block text-left">
              <span className="block text-sm font-semibold">Developer</span>
              <span className="block text-xs text-muted-foreground">
                Deliver tasks and subtasks
              </span>
            </span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Your role decides what you can do, and it can't be changed by you later.
        </p>
      </div>
    </AuthLayout>
  );
}
