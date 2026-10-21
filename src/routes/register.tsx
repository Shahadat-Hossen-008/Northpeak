import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/builder/layout/auth-layout";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import type { AppRole } from "@/types";
import { api } from "@/lib/api";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({
    role: z.enum(["manager", "developer"]).optional().catch(undefined),
  }),
  head: () => {
    const page = meta(
      "Create account",
      "Create a Northpeak account as a project manager or developer.",
      "/register",
    );
    return { ...page, meta: [...page.meta, { name: "robots", content: "noindex, follow" }] };
  },
  component: RegisterPage,
});

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

function RegisterPage() {
  const navigate = useNavigate();
  const { role: roleFromSearch } = Route.useSearch();
  const { user, role, loading, reload } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [selectedRole, setSelectedRole] = useState<AppRole>(roleFromSearch ?? "developer");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: role ? homePathForRole(role) : "/welcome", replace: true });
  }, [loading, user, role, navigate]);

  function validate() {
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await api.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: selectedRole,
      });
      setSubmitting(false);
      toast.success("Check your email for a verification code");
      void navigate({
        to: "/verify-email",
        search: { email: data.email, role: selectedRole },
        replace: true,
      });
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "Failed to create account";
      toast.error(message);
    }
  }

  async function handleGoogleSuccess(userRole: AppRole) {
    await reload();
    void navigate({ to: homePathForRole(userRole), replace: true });
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        selectedRole === "manager"
          ? "Set up your Northpeak account, then bring your team’s work into focus."
          : "Set up your Northpeak account and turn your next sprint into clear, actionable work."
      }
      asideTitle={
        selectedRole === "manager"
          ? "Lead with the whole sprint in view."
          : "Stay close to the work that ships."
      }
      asideBody={
        selectedRole === "manager"
          ? "Northpeak keeps capacity, risk, and overdue work visible so your team can move with confidence."
          : "Northpeak keeps your tasks, subtasks, and deadline health together so focus is easy to protect."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <GoogleSignInButton
          role={selectedRole}
          onSuccess={(googleRole) => void handleGoogleSuccess(googleRole)}
          onError={(message) => toast.error(message)}
          disabled={submitting}
        />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>or use your email</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-3">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sarah Khan"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "register-name-error" : undefined}
          />
          {errors.name ? (
            <p id="register-name-error" role="alert" className="text-xs sm:text-sm text-danger">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "register-email-error" : undefined}
          />
          {errors.email ? (
            <p id="register-email-error" role="alert" className="text-xs sm:text-sm text-danger">
              {errors.email}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "register-password-error" : undefined}
            />
            {errors.password ? (
              <p
                id="register-password-error"
                role="alert"
                className="text-xs sm:text-sm text-danger"
              >
                {errors.password}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              placeholder="Confirm password"
              aria-invalid={Boolean(errors.confirm)}
              aria-describedby={errors.confirm ? "register-confirm-error" : undefined}
            />
            {errors.confirm ? (
              <p
                id="register-confirm-error"
                role="alert"
                className="text-xs sm:text-sm text-danger"
              >
                {errors.confirm}
              </p>
            ) : null}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
