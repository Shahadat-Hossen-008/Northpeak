import { AppShell } from "@/builder/layout/app-shell";
import { NotificationPanel } from "@/sections/notification-panel";
import { PageHeader } from "@/components/page-header";
import { WorkspaceLoadingState } from "@/components/feedback/workspace-loading-state";
import { useNotifications, useProjects } from "@/hooks/queries";
import type { NotificationsPageProps } from "./interface";

export function NotificationsPage({ section }: NotificationsPageProps) {
  const notifications = useNotifications();
  const projects = useProjects();
  const loading =
    (notifications.isLoading && !notifications.data) || (projects.isLoading && !projects.data);

  return (
    <AppShell section={section}>
      {loading ? (
        <WorkspaceLoadingState />
      ) : (
        <>
          <PageHeader
            title="Notifications"
            description="Assignments, deadlines, comments and progress updates."
          />
          <div className="mt-6">
            <NotificationPanel />
          </div>
        </>
      )}
    </AppShell>
  );
}

export default NotificationsPage;
export type { NotificationsPageProps } from "./interface";
