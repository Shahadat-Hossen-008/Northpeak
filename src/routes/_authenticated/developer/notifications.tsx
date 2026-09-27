import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage, meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/developer/notifications")({
  head: () => meta("Notifications", "Your assignments, deadlines and comment updates."),
  component: () => <NotificationsPage section="developer" />,
});
