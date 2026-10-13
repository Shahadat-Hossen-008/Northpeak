import { Link, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import type { ServerErrorPageProps } from "./interface";

export function ServerErrorPage({ error, reset, className }: ServerErrorPageProps) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }

  const [isRetrying, setIsRetrying] = useState(false);
  const { role, user } = useAuth();
  const targetHref = user && role ? homePathForRole(role) : "/";
  const buttonLabel = user && role ? "Back to Dashboard" : "Back to Home";

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      if (reset) {
        reset();
      }
      if (router?.invalidate) {
        await router.invalidate();
      }
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, reset, router]);

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col justify-between bg-[#F5F8FE] dark:bg-background text-foreground transition-colors selection:bg-danger/20",
        className,
      )}
      style={{
        backgroundImage: `
          radial-gradient(900px 480px at 85% -10%, rgba(227, 237, 255, 0.7) 0%, transparent 60%),
          radial-gradient(700px 420px at -10% 110%, rgba(238, 233, 255, 0.7) 0%, transparent 60%)
        `,
      }}
    >
      {/* Top Header */}
      <header className="px-6 py-5 sm:px-8 flex items-center justify-between">
        <Link to="/" aria-label="Northpeak home" className="flex items-center gap-2.5">
          <img src="/logo-mark.png" alt="Northpeak" className="h-8 w-auto object-contain" />
          <span className="text-lg font-bold tracking-tight text-foreground">Northpeak</span>
        </Link>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 grid place-items-center px-4 py-8">
        <section
          aria-labelledby="server-error-heading"
          className="w-full max-w-125 rounded-2xl border border-border/80 bg-card p-8 sm:p-10 text-center shadow-lg dark:shadow-none"
        >
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFECEF] dark:bg-danger/15 px-3 py-1.5 text-xs font-semibold text-[#C81E43] dark:text-danger">
            <span className="size-1.5 rounded-full bg-current" />
            Error 500
          </span>

          {/* Logo Mark Graphic */}
          <div className="mt-5 flex justify-center" aria-hidden="true">
            <img
              src="/logo-mark.png"
              alt=""
              className="h-14 sm:h-16 w-auto object-contain select-none"
            />
          </div>

          {/* 500 Large Code */}
          <div
            aria-hidden="true"
            className="mt-2 text-7xl sm:text-8xl font-extrabold tracking-tight select-none bg-linear-to-br from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent"
          >
            500
          </div>

          {/* Title & Description */}
          <h1
            id="server-error-heading"
            className="mt-3 text-2xl font-bold tracking-tight text-foreground"
          >
            Something went wrong
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            We hit an unexpected problem while loading this page. Please try again or head back to
            your dashboard.
          </p>

          {error?.message ? (
            <p className="mx-auto mt-3 max-w-md rounded-md bg-muted/60 p-2 font-mono text-xs text-muted-foreground truncate">
              {error.message}
            </p>
          ) : null}

          {/* Action Buttons: Try Again & Back to Dashboard/Home */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={handleRetry}
              disabled={isRetrying}
              className="min-w-36 shadow-sm cursor-pointer"
            >
              {isRetrying ? "Retrying…" : "Try again"}
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-36 shadow-sm">
              <Link to={targetHref}>{buttonLabel}</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground/80 py-6">
        Northpeak · Build better, together
      </footer>
    </div>
  );
}

export default ServerErrorPage;
export type { ServerErrorPageProps } from "./interface";
