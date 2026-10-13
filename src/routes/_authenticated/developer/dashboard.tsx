import { createFileRoute } from "@tanstack/react-router";
import { DeveloperDashboardPage } from "@/builder/pages/developer-dashboard";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/developer/dashboard")({
  head: () => meta("My work", "Your assigned tasks on a board with live deadline status."),
  component: DeveloperDashboardRoute,
});

function DeveloperDashboardRoute() {
  return <DeveloperDashboardPage />;
}
