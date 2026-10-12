import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/builder/pages/notifications";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/developer/notifications")({
  head: () => meta("Notifications", "Your assignments, deadlines and comment updates."),
  component: () => <NotificationsPage section="developer" />,
});
