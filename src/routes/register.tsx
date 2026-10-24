import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/builder/layout/auth-layout";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import {
  EmailVerificationForm,
  CODE_LIFETIME_SECONDS,
} from "@/components/auth/email-verification-form";
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
    email: z.string().email().optional().catch(undefined),
    step: z.enum(["register", "verify"]).optional().catch(undefined),
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

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string | undefined>>;

function validateName(val: string): string | undefined {
  if (val.trim().length < 2) return "Enter your full name.";
  return undefined;
}

function validateEmail(val: string): string | undefined {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    return "Enter a valid email address.";
  }
  return undefined;
}

function validatePassword(val: string): string | undefined {
  if (val.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return undefined;
}

function validateConfirm(password: string, confirm: string): string | undefined {
  if (password !== confirm) return "Passwords do not match.";
  return undefined;
}

function RegisterPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { role: roleFromSearch, email: emailFromSearch, step: stepFromSearch } = search;
  const { user, role, loading, reload } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: emailFromSearch ?? "",
    password: "",
    confirm: "",
  });
  const [selectedRole, setSelectedRole] = useState<AppRole>(roleFromSearch ?? "developer");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Two-step flow state: step 1 ("register") or step 2 ("verify") on the same URL
  const [step, setStep] = useState<"register" | "verify">(
    stepFromSearch === "verify" && emailFromSearch ? "verify" : "register",
  );
  const [pendingEmail, setPendingEmail] = useState<string>(emailFromSearch ?? "");
  const [codeExpiresInSeconds, setCodeExpiresInSeconds] = useState<number>(CODE_LIFETIME_SECONDS);
  const [hasSubmittedOnce, setHasSubmittedOnce] = useState(false);
  const [resubmitNotice, setResubmitNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: role ? homePathForRole(role) : "/welcome", replace: true });
  }, [loading, user, role, navigate]);

  function validate() {
    const next: Errors = {};
    const nameErr = validateName(form.name);
    const emailErr = validateEmail(form.email);
    const passwordErr = validatePassword(form.password);
    const confirmErr = validateConfirm(form.password, form.confirm);
    if (nameErr) next.name = nameErr;
    if (emailErr) next.email = emailErr;
    if (passwordErr) next.password = passwordErr;
    if (confirmErr) next.confirm = confirmErr;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
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
      // Switch in-place to Step 2 (OTP verification) on the same URL
      setPendingEmail(data.email);
      setCodeExpiresInSeconds(data.codeExpiresInSeconds ?? CODE_LIFETIME_SECONDS);
      if (hasSubmittedOnce) {
        setResubmitNotice("A new code was sent. Earlier codes no longer work.");
      } else {
        setResubmitNotice(null);
        setHasSubmittedOnce(true);
      }
      setStep("verify");
    } catch (error) {
      setSubmitting(false);
      const message = error instanceof Error ? error.message : "Failed to create account";
      setServerError(message);
      toast.error(message);
    }
  }

  function handleBackToRegister() {
    setStep("register");
    setServerError(null);
  }

  async function handleGoogleSuccess(userRole: AppRole) {
    await reload();
    void navigate({ to: homePathForRole(userRole), replace: true });
  }

  const isVerify = step === "verify";

  const title = isVerify ? "Check your inbox" : "Create your account";
  const subtitle = isVerify
    ? pendingEmail
      ? `Enter the six-digit code sent to ${pendingEmail}.`
      : "Enter the six-digit code sent to your email."
    : selectedRole === "manager"
      ? "Set up your Northpeak account, then bring your team’s work into focus."
      : "Set up your Northpeak account and turn your next sprint into clear, actionable work.";

  const asideTitle = isVerify
    ? "One quick check, then you’re in."
    : selectedRole === "manager"
      ? "Lead with the whole sprint in view."
      : "Stay close to the work that ships.";

  const asideBody = isVerify
    ? "Verify your email to keep your Northpeak workspace and account updates connected to you."
    : selectedRole === "manager"
      ? "Northpeak keeps capacity, risk, and overdue work visible so your team can move with confidence."
      : "Northpeak keeps your tasks, subtasks, and deadline health together so focus is easy to protect.";

  const footer = isVerify ? (
    <>
      Need to use a different address?{" "}
      <button
        type="button"
        onClick={handleBackToRegister}
        className="font-semibold text-primary hover:underline"
      >
        Change registration details
      </button>
    </>
  ) : (
    <>
      Already have an account?{" "}
      <Link to="/login" className="font-semibold text-primary hover:underline">
        Sign in
      </Link>
    </>
  );

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      asideTitle={asideTitle}
      asideBody={asideBody}
      footer={footer}
    >
      {isVerify ? (
        <EmailVerificationForm
          email={pendingEmail}
          role={selectedRole}
          codeExpiresInSeconds={codeExpiresInSeconds}
          notice={resubmitNotice}
          onBack={handleBackToRegister}
        />
      ) : (
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
              onChange={(e) => {
                const nextName = e.target.value;
                setForm((prev) => ({ ...prev, name: nextName }));
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
                if (serverError) setServerError(null);
              }}
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
              onChange={(e) => {
                const nextEmail = e.target.value;
                setForm((prev) => ({ ...prev, email: nextEmail }));
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
                if (serverError) setServerError(null);
              }}
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
                onChange={(e) => {
                  const nextPassword = e.target.value;
                  setForm((prev) => ({ ...prev, password: nextPassword }));
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                  if (serverError) setServerError(null);
                }}
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
                onChange={(e) => {
                  const nextConfirm = e.target.value;
                  setForm((prev) => ({ ...prev, confirm: nextConfirm }));
                  if (errors.confirm) {
                    setErrors((prev) => ({ ...prev, confirm: undefined }));
                  }
                  if (serverError) setServerError(null);
                }}
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

          {serverError ? (
            <p role="alert" className="text-xs sm:text-sm text-danger">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
export default RegisterPage;
