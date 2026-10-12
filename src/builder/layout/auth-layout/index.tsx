import { Brand } from "@/builder/layout/app-shell";
import type { AuthLayoutProps } from "./interface";

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Brand />
          <h1 className="mt-8 text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
      <div className="hidden flex-col justify-center border-l border-border bg-card px-12 lg:flex">
        <blockquote className="max-w-md">
          <p className="text-xl leading-relaxed font-semibold text-foreground">
            “Every task carries its own deadline signal — on track, due soon, overdue or completed
            late. Nothing slips quietly.”
          </p>
          <footer className="mt-4 text-sm text-muted-foreground">
            Northpeak — project management for software teams
          </footer>
        </blockquote>
        <dl className="mt-10 grid grid-cols-3 gap-6">
          {[
            { k: "Projects tracked", v: "4" },
            { k: "Active tasks", v: "12" },
            { k: "Developers", v: "4" },
          ].map((item) => (
            <div key={item.k}>
              <dt className="text-xs text-muted-foreground">{item.k}</dt>
              <dd className="tabular text-2xl font-bold text-foreground">{item.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default AuthLayout;
export type { AuthLayoutProps } from "./interface";
