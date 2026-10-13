import { createFileRoute } from "@tanstack/react-router";
import { ManagerDashboardPage } from "@/builder/pages/manager-dashboard";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () =>
    meta(
      "Manager dashboard",
      "Project progress, overdue work, developer workload and upcoming deadlines.",
    ),
  component: ManagerDashboardRoute,
});

function ManagerDashboardRoute() {
  return <ManagerDashboardPage />;
}
