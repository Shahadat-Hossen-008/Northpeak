import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { homePathForRole, useAuth, type AppRole } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/register")({
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
  const { user, role, loading, reload } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [selectedRole, setSelectedRole] = useState<AppRole>("manager");
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
    if (form.password.length < 6) next.password = "Use at least 6 characters.";
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
      subtitle="Set up your workspace in under a minute."
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
          {errors.name ? <p className="text-xs text-danger">{errors.name}</p> : null}
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
          {errors.email ? <p className="text-xs text-danger">{errors.email}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {errors.password ? <p className="text-xs text-danger">{errors.password}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
            {errors.confirm ? <p className="text-xs text-danger">{errors.confirm}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label>I am a…</Label>
          <RadioGroup
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as AppRole)}
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                {
                  value: "manager",
                  label: "Project manager",
                  hint: "Create projects and assign work",
                },
                {
                  value: "developer",
                  label: "Developer",
                  hint: "Deliver tasks and subtasks",
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selectedRole === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
