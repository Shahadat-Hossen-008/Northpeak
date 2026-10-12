import { AppShell } from "@/builder/layout/app-shell";
import { NotificationPanel } from "@/sections/notification-panel";
import { PageHeader } from "@/components/page-header";
import type { NotificationsPageProps } from "./interface";

export function NotificationsPage({ section }: NotificationsPageProps) {
  return (
    <AppShell section={section}>
      <PageHeader
        title="Notifications"
        description="Assignments, deadlines, comments and progress updates."
      />
      <div className="mt-6">
        <NotificationPanel />
      </div>
    </AppShell>
  );
}

export default NotificationsPage;
export type { NotificationsPageProps } from "./interface";
