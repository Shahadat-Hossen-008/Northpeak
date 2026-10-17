import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/builder/layout/auth-layout";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homePathForRole, useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Northpeak" },
      { name: "description", content: "Sign in to your Northpeak project workspace." },
      { property: "og:title", content: "Sign in — Northpeak" },
      { property: "og:description", content: "Sign in to your Northpeak project workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, role, loading, reload } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: role ? homePathForRole(role) : "/welcome", replace: true });
  }, [loading, user, role, navigate]);

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await api.login({ email, password });
      setSubmitting(false);
      toast.success("Welcome back");
      await reload();
      void navigate({ to: homePathForRole(data.user.role), replace: true });
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "Failed to sign in";
      toast.error(message);
    }
  }

  return (
    <AuthLayout
      title="Welcome back to the work."
      subtitle="Pick up where your team left off — projects, tasks, and deadline signals are ready for you."
      asideTitle="Return to a clearer sprint."
      asideBody="See what changed, find the next task that matters, and keep collaboration moving without another status meeting."
      footer={
        <>
          New to Northpeak?{" "}
          <Link to="/get-started" className="font-semibold text-primary hover:underline">
            Get started
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? <p className="text-xs sm:text-sm text-danger">{errors.email}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password ? (
            <p className="text-xs sm:text-sm text-danger">{errors.password}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
            Remember me
          </label>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
}
