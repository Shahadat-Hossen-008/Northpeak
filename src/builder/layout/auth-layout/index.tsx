import { Brand } from "@/builder/layout/app-shell";
import { HomeFooter, HomeNav } from "@/components/home";
import type { AuthLayoutProps } from "./interface";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  asideTitle = "Make every deadline visible.",
  asideBody = "Northpeak turns project work into a clear, shared view of what needs attention next.",
  asideStats = [
    { label: "Projects tracked", value: "4" },
    { label: "Active tasks", value: "12" },
    { label: "Developers", value: "4" },
  ],
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeNav />
      <div className="grid min-h-[calc(100vh-4.5rem)] lg:grid-cols-2">
        <main className="flex items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
          <div className="w-full max-w-md lg:max-w-lg">
            <div className="lg:hidden">
              <Brand />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? (
              <div className="mt-6 text-sm leading-6 text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </main>
        <aside className="hidden flex-col justify-center border-l border-border bg-card px-12 lg:flex">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-primary">Northpeak workspace</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">{asideTitle}</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{asideBody}</p>
            <dl className="mt-10 grid grid-cols-3 gap-6">
              {asideStats.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
      <HomeFooter />
    </div>
  );
}

export default AuthLayout;
export type { AuthLayoutProps } from "./interface";
