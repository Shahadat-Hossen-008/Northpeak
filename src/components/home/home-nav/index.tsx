import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutDashboard, Menu } from "lucide-react";
import { useState } from "react";

import { Brand } from "@/builder/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/auth-utils";
import { cn } from "@/lib/utils";
import type { HomeNavProps } from "./interface";

export function HomeNav({ currentPath = "/", className }: HomeNavProps) {
  const { user, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardPath = role ? homePathForRole(role) : "/welcome";

  const navLinks = [
    { label: "Features", to: "/features" },
    { label: "Roles & Workflows", to: "/roles" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        {/* Left: Brand */}
        <Link
          to="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
        >
          <Brand />
        </Link>

        {/* Right: Desktop Navigation & Auth Actions */}
        <div className="hidden md:flex items-center gap-7">
          <nav className="flex items-center gap-6 text-sm sm:text-base font-medium">
            {navLinks.map((link) => {
              const isActive = currentPath === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "transition-colors hover:text-foreground",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2.5">
            {user ? (
              <Button asChild size="default">
                <Link to={dashboardPath}>
                  <LayoutDashboard className="size-4" />
                  Dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="default">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="default">
                  <Link to="/get-started">
                    Get started
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Trigger */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Button asChild size="sm" variant="outline" className="text-xs sm:text-sm h-8.5 px-3">
              <Link to={dashboardPath}>Dashboard</Link>
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6 flex flex-col justify-between">
              <div>
                <SheetTitle className="text-left font-bold text-lg mb-6 flex items-center gap-2">
                  <Brand />
                </SheetTitle>
                <nav className="flex flex-col gap-3 text-base font-medium">
                  <Link
                    to="/"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "py-2 transition-colors hover:text-foreground",
                      currentPath === "/" ? "text-primary font-bold" : "text-muted-foreground",
                    )}
                  >
                    Home Overview
                  </Link>
                  {navLinks.map((link) => {
                    const isActive = currentPath === link.to;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "py-2 transition-colors hover:text-foreground",
                          isActive ? "text-primary font-bold" : "text-muted-foreground",
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-6 border-t border-border flex flex-col gap-2.5">
                {user ? (
                  <Button asChild className="w-full">
                    <Link to={dashboardPath} onClick={() => setMobileOpen(false)}>
                      Go to Dashboard
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/login" onClick={() => setMobileOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link to="/get-started" onClick={() => setMobileOpen(false)}>
                        Get started
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export default HomeNav;
export type { HomeNavProps } from "./interface";
