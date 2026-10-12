import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/builder/pages/settings";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/manager/settings")({
  head: () => meta("Settings", "Manager profile and account settings."),
  component: () => <SettingsPage section="manager" />,
});
