import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EmailVerificationFormProps } from "./interface";

// Mirrors server CODE_TTL_MS (2 minutes)
export const CODE_LIFETIME_SECONDS = 120;

// UI cooldown before allowing another resend request (UI only)
export const RESEND_COOLDOWN_SECONDS = 30;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EmailVerificationForm({
  email,
  role,
  codeExpiresInSeconds,
  notice,
  onSuccess,
  onBack,
  className,
}: EmailVerificationFormProps) {
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Code lifetime countdown (starts from codeExpiresInSeconds or default 120)
  const [codeSecondsLeft, setCodeSecondsLeft] = useState<number>(
    codeExpiresInSeconds ?? CODE_LIFETIME_SECONDS,
  );

  // 2. Resend button UI cooldown (30 seconds after each send)
  const [resendSecondsLeft, setResendSecondsLeft] = useState<number>(RESEND_COOLDOWN_SECONDS);

  // 3. Informational notice (e.g. earlier codes no longer work)
  const [noticeMessage, setNoticeMessage] = useState<string | null>(notice ?? null);

  useEffect(() => {
    setCodeSecondsLeft(codeExpiresInSeconds ?? CODE_LIFETIME_SECONDS);
  }, [codeExpiresInSeconds]);

  useEffect(() => {
    setNoticeMessage(notice ?? null);
  }, [notice]);

  // Code lifetime countdown timer
  useEffect(() => {
    if (codeSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => setCodeSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [codeSecondsLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => setResendSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || resending || code.length !== 6 || !email || codeSecondsLeft <= 0) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await api.verifyEmail({ email: email.trim().toLowerCase(), code: code.trim() });
      await reload();
      toast.success("Email verified");
      if (onSuccess) {
        onSuccess(data.user);
      } else {
        void navigate({ to: homePathForRole(data.user.role), replace: true });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not verify this code";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!email || resendSecondsLeft > 0 || resending || submitting) return;
    setResending(true);
    setErrorMessage(null);
    try {
      const result = await api.resendVerification(email.trim().toLowerCase());
      toast.success(result.message || "A new code has been sent.");
      setCode("");
      // Reset code lifetime countdown after resend (mirrors server 120s)
      setCodeSecondsLeft(CODE_LIFETIME_SECONDS);
      // Reset UI resend cooldown to 30s
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setNoticeMessage("A new code was sent. Earlier codes no longer work.");
    } catch (error) {
      // Show server 429 message (or other error) as it is, inline and in a toast
      const msg = error instanceof Error ? error.message : "Could not send another code";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {noticeMessage ? (
        <div
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs sm:text-sm text-foreground"
        >
          {noticeMessage}
        </div>
      ) : null}

      <form onSubmit={verify} className="space-y-6" noValidate>
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(val) => {
            setCode(val);
            if (errorMessage) setErrorMessage(null);
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Six-digit email verification code"
          disabled={submitting || !email || codeSecondsLeft <= 0}
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

        <div className="flex items-center justify-between text-xs sm:text-sm">
          {codeSecondsLeft > 0 ? (
            <span className="text-muted-foreground">
              Code expires in{" "}
              <span className="font-semibold text-foreground">{formatTime(codeSecondsLeft)}</span>
            </span>
          ) : (
            <span role="alert" className="font-medium text-danger">
              This code has expired. Send a new code.
            </span>
          )}
        </div>

        {!email ? (
          <p role="alert" className="text-sm text-danger">
            No pending registration email found. Please enter your registration details to request a
            code.
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-xs sm:text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !email || code.length !== 6 || codeSecondsLeft <= 0}
        >
          {submitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Didn’t receive the code?</span>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={!email || resendSecondsLeft > 0 || resending || submitting}
          className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resending
            ? "Sending…"
            : resendSecondsLeft > 0
              ? `Resend in ${resendSecondsLeft}s`
              : "Resend code"}
        </button>
      </div>

      {onBack ? (
        <div className="mt-4 pt-2 text-center border-t border-border/50">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting || resending}
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Change registration details
          </button>
        </div>
      ) : null}
    </div>
  );
}
