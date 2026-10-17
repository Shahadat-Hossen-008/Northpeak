import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/builder/layout/auth-layout";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import type { AppRole } from "@/types";
import { api } from "@/lib/api";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({
    role: z.enum(["manager", "developer"]).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Create account — Northpeak" },
      {
        name: "description",
        content: "Create a Northpeak account as a project manager or developer.",
      },
      { property: "og:title", content: "Create account — Northpeak" },
      {
        property: "og:description",
        content: "Create a Northpeak account as a project manager or developer.",
      },
    ],
  }),
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
      toast.success("Account created");
      await reload();
      void navigate({ to: homePathForRole(data.user.role), replace: true });
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "Failed to create account";
      toast.error(message);
    }
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
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sarah Khan"
          />
          {errors.name ? <p className="text-xs sm:text-sm text-danger">{errors.name}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
          {errors.email ? <p className="text-xs sm:text-sm text-danger">{errors.email}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
            />
            {errors.password ? (
              <p className="text-xs sm:text-sm text-danger">{errors.password}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              placeholder="Confirm password"
            />
            {errors.confirm ? (
              <p className="text-xs sm:text-sm text-danger">{errors.confirm}</p>
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
