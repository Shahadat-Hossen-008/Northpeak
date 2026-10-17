import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CheckSquare,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/avatar";
import { useAuth, homePathForRole } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { AppShellProps, BrandProps } from "./interface";

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard };

const MANAGER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/manager/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/manager/projects", icon: FolderKanban },
  { label: "Tasks", to: "/manager/tasks", icon: CheckSquare },
  { label: "Team", to: "/manager/team", icon: Users },
  { label: "Notifications", to: "/manager/notifications", icon: Bell },
  { label: "Settings", to: "/manager/settings", icon: Settings },
];

const DEVELOPER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/developer/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/developer/projects", icon: FolderKanban },
  { label: "My tasks", to: "/developer/tasks", icon: CheckSquare },
  { label: "Notifications", to: "/developer/notifications", icon: Bell },
  { label: "Settings", to: "/developer/settings", icon: Settings },
];

export function Brand({ className }: BrandProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/logo-mark.png"
        alt="Northpeak"
        className="size-7.5 rounded-md object-contain shrink-0"
      />
      <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">
        Northpeak
      </span>
    </div>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm lg:text-base font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="size-4.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HomeLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm lg:text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Home className="size-4.5 shrink-0" aria-hidden />
      Visit homepage
    </Link>
  );
}

export function AppShell({
  section,
  children,
  contentClassName,
  constrainToViewport = false,
}: AppShellProps) {
  const { user, profile, role, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.is_read).length;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!role) {
      void navigate({ to: "/welcome", replace: true });
      return;
    }
    if (role !== section) {
      void navigate({ to: homePathForRole(role), replace: true });
    }
  }, [loading, user, role, section, navigate]);

  function signOut() {
    logout();
    void navigate({ to: "/login", replace: true });
  }

  const items = section === "manager" ? MANAGER_NAV : DEVELOPER_NAV;
  const name = profile?.name ?? user?.email ?? "Member";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Link
          to="/"
          aria-label="Go to Northpeak homepage"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Brand className="px-2" />
        </Link>
        <p className="mt-1 px-2 text-xs sm:text-sm font-medium text-muted-foreground capitalize">
          {section} workspace
        </p>
        <div className="mt-6 flex-1">
          <NavLinks items={items} />
        </div>
        <div className="mb-3 border-t border-sidebar-border pt-3">
          <HomeLink />
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm lg:text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <LogOut className="size-4.5" aria-hidden />
          Sign out
        </button>
      </aside>

      <div
        className={cn(
          "min-h-screen lg:pl-64",
          constrainToViewport && "flex flex-col lg:h-screen lg:overflow-hidden",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-5">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Link to="/" onClick={() => setOpen(false)} aria-label="Go to Northpeak homepage">
                  <Brand />
                </Link>
                <div className="mt-6">
                  <NavLinks items={items} onNavigate={() => setOpen(false)} />
                </div>
                <div className="mt-3 border-t border-sidebar-border pt-3">
                  <HomeLink onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link
              to="/"
              aria-label="Go to Northpeak homepage"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            >
              <Brand />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={section === "manager" ? "/manager/notifications" : "/developer/notifications"}
              className="relative inline-flex size-9.5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1.5 py-0.2 text-xs font-bold text-danger-foreground">
                  {unread}
                </span>
              ) : null}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-secondary cursor-pointer">
                  <UserAvatar name={name} size="sm" />
                  <span className="hidden text-sm sm:text-base font-medium sm:inline">{name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuLabel>
                  <span className="block text-sm sm:text-base font-semibold">{name}</span>
                  <span className="block text-xs sm:text-sm font-normal text-muted-foreground capitalize">
                    {role ?? "member"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-sm sm:text-base py-2">
                  <Link to={section === "manager" ? "/manager/settings" : "/developer/settings"}>
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-sm sm:text-base py-2">
                  <Link to="/">Visit homepage</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-sm sm:text-base py-2 cursor-pointer"
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8", contentClassName)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
export type { AppShellProps, BrandProps } from "./interface";
