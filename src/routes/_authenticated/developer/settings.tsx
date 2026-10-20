import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/builder/pages/settings";
import { meta } from "@/builder/layout/meta";

export const Route = createFileRoute("/_authenticated/developer/settings")({
  head: () => meta("Settings", "Developer profile and account settings.", "/developer/settings"),
  component: () => <SettingsPage section="developer" />,
});
