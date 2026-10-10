import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Mountain,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
import { UserAvatar } from "@/components/primitives";
import { useAuth, homePathForRole, type AppRole } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/queries";
import { cn } from "@/lib/utils";

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

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Mountain className="size-4" aria-hidden />
      </span>
      <span className="text-base font-bold tracking-tight">Northpeak</span>
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ section, children }: { section: AppRole; children: ReactNode }) {
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
        <Brand className="px-2" />
        <p className="mt-1 px-2 text-xs font-medium text-muted-foreground capitalize">
          {section} workspace
        </p>
        <div className="mt-6 flex-1">
          <NavLinks items={items} />
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-5">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <div className="mt-6">
                  <NavLinks items={items} onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Brand className="lg:hidden" />
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={section === "manager" ? "/manager/notifications" : "/developer/notifications"}
              className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground">
                  {unread}
                </span>
              ) : null}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary">
                  <UserAvatar name={name} size="sm" />
                  <span className="hidden text-sm font-medium sm:inline">{name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <span className="block text-sm font-semibold">{name}</span>
                  <span className="block text-xs font-normal text-muted-foreground capitalize">
                    {role ?? "member"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={section === "manager" ? "/manager/settings" : "/developer/settings"}>
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
