import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage, meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/manager/settings")({
  head: () => meta("Settings", "Manager profile and account settings."),
  component: () => <SettingsPage section="manager" />,
});
