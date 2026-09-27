import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage, meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/manager/notifications")({
  head: () => meta("Notifications", "Team notifications for managers."),
  component: () => <NotificationsPage section="manager" />,
});
