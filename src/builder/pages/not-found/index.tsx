import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import type { NotFoundPageProps } from "./interface";

export function NotFoundPage({ className }: NotFoundPageProps) {
  const { role, user } = useAuth();
  const targetHref = user && role ? homePathForRole(role) : "/";
  const buttonLabel = user && role ? "Back to Dashboard" : "Back to Home";

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col justify-between bg-[#F5F8FE] dark:bg-background text-foreground transition-colors selection:bg-primary/20",
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
          aria-labelledby="not-found-heading"
          className="w-full max-w-125 rounded-2xl border border-border/80 bg-card p-8 sm:p-10 text-center shadow-lg dark:shadow-none"
        >
          {/* Badge */}
          <span className="inline-flex items-center gap-2 rounded-full bg-[#E8F1FF] dark:bg-primary/15 px-3 py-1.5 text-xs font-semibold text-[#0F5BCB] dark:text-primary">
            <span className="size-1.5 rounded-full bg-current" />
            Error 404
          </span>

          {/* Logo Mark Graphic */}
          <div className="mt-5 flex justify-center" aria-hidden="true">
            <img
              src="/logo-mark.png"
              alt=""
              className="h-14 sm:h-16 w-auto object-contain select-none"
            />
          </div>

          {/* 404 Large Code */}
          <div
            aria-hidden="true"
            className="mt-2 text-7xl sm:text-8xl font-extrabold tracking-tight select-none bg-linear-to-br from-[#1570EF] to-[#7B6BF0] bg-clip-text text-transparent"
          >
            404
          </div>

          {/* Title & Description */}
          <h1
            id="not-found-heading"
            className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-foreground"
          >
            This page isn’t on the map
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm sm:text-base leading-relaxed text-muted-foreground">
            The page you’re looking for doesn’t exist or has been moved.
          </p>

          {/* Single Simple Action Button */}
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="min-w-44 shadow-sm">
              <Link to={targetHref}>{buttonLabel}</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs sm:text-sm text-muted-foreground/80 py-6">
        Northpeak · Build better, together
      </footer>
    </div>
  );
}

export default NotFoundPage;
export type { NotFoundPageProps } from "./interface";
