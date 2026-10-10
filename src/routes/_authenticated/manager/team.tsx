import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { statusOf } from "@/components/badges";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  ProgressBar,
  UserAvatar,
} from "@/components/primitives";
import { meta } from "@/components/pages";
import { useMembers, useTasks } from "@/hooks/queries";

export const Route = createFileRoute("/_authenticated/manager/team")({
  head: () => meta("Team", "Developer workload, active, completed and overdue tasks."),
  component: Team,
});

function Team() {
  const members = useMembers();
  const tasks = useTasks();
  const devs = (members.data ?? []).filter((m) => m.role === "developer");
  const all = tasks.data ?? [];
  return (
    <AppShell section="manager">
      <PageHeader
        title="Team"
        description="See who is carrying what, and where deadlines are slipping."
      />
      <div className="mt-6">
        {members.isLoading || tasks.isLoading ? (
          <LoadingState />
        ) : devs.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No developers yet"
            description="Developers appear here once they register."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devs.map((dev) => {
              const mine = all.filter((t) => t.assigned_developer_id === dev.id);
              const active = mine.filter((t) => !t.is_completed).length;
              const done = mine.length - active;
              const overdue = mine.filter((t) => statusOf(t) === "overdue").length;
              const load = Math.min(100, active * 20);
              return (
                <div key={dev.id} className="surface-card p-5">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={dev.name} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{dev.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dev.email ?? "Developer"}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted p-2">
                      <dt className="text-xs text-muted-foreground">Active</dt>
                      <dd className="tabular font-bold">{active}</dd>
                    </div>
                    <div className="rounded-md bg-success/10 p-2">
                      <dt className="text-xs text-muted-foreground">Done</dt>
                      <dd className="tabular font-bold text-success">{done}</dd>
                    </div>
                    <div className="rounded-md bg-destructive/10 p-2">
                      <dt className="text-xs text-muted-foreground">Overdue</dt>
                      <dd className="tabular font-bold text-destructive">{overdue}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Workload</span>
                      <span className="tabular">{load}%</span>
                    </div>
                    <ProgressBar
                      value={load}
                      tone={overdue > 0 ? "danger" : load > 60 ? "warning" : "primary"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
