import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/builder/pages/notifications";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/manager/notifications")({
  head: () => meta("Notifications", "Team notifications for managers."),
  component: () => <NotificationsPage section="manager" />,
});
