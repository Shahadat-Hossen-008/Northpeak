import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homePathForRole, useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, role, loading } = useAuth();
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!remember) sessionStorage.setItem("northpeak:ephemeral", "1");
    toast.success("Welcome back");
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
  }

  async function handleForgotPassword() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter your email address first, then tap Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent. Check your inbox.");
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your projects, tasks and deadlines."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
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
          {errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password ? <p className="text-xs text-danger">{errors.password}</p> : null}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
            Remember me
          </label>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        OR
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
    </AuthLayout>
  );
}
