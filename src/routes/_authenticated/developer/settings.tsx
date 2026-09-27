import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage, meta } from "@/components/pages";

export const Route = createFileRoute("/_authenticated/developer/settings")({
  head: () => meta("Settings", "Developer profile and account settings."),
  component: () => <SettingsPage section="developer" />,
});
