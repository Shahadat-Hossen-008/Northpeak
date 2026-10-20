import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/builder/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { api } from "@/lib/api";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({
    email: z.string().email().catch(""),
    role: z.enum(["manager", "developer"]).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Verify your email | Northpeak" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email, role } = Route.useSearch();
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6 || !email) return;
    setSubmitting(true);
    try {
      const data = await api.verifyEmail({ email, code });
      await reload();
      toast.success("Email verified");
      void navigate({ to: homePathForRole(data.user.role), replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify this code");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!email || secondsLeft > 0) return;
    setResending(true);
    try {
      const result = await api.resendVerification(email);
      toast.success(result.message);
      setCode("");
      setSecondsLeft(60);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send another code");
      setSecondsLeft(60);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={
        email
          ? `Enter the six-digit code sent to ${email}.`
          : "Enter the six-digit code sent to your email."
      }
      asideTitle="One quick check, then you’re in."
      asideBody="Verify your email to keep your Northpeak workspace and account updates connected to you."
      footer={
        <>
          Wrong email?{" "}
          <Link
            to="/register"
            search={{ role }}
            className="font-semibold text-primary hover:underline"
          >
            Create a new account
          </Link>
        </>
      }
    >
      <form onSubmit={verify} className="space-y-6">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Six-digit email verification code"
          disabled={submitting || !email}
          containerClassName="justify-start"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 w-12 text-base sm:h-14 sm:w-14"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {!email ? (
          <p role="alert" className="text-sm text-danger">
            Open this page from registration or sign in again to request a code.
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !email || code.length !== 6}
        >
          {submitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Didn’t receive the code?</span>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={!email || secondsLeft > 0 || resending}
          className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resending ? "Sending…" : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
        </button>
      </div>
    </AuthLayout>
  );
}
