import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { NotificationPanel } from "@/components/NotificationPanel";
import { PageHeader, SectionCard, UserAvatar } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import type { Task } from "@/hooks/queries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export function NotificationsPage({ section }: { section: AppRole }) {
  return (
    <AppShell section={section}>
      <PageHeader title="Notifications" description="Assignments, deadlines, comments and progress updates." />
      <div className="mt-6">
        <NotificationPanel />
      </div>
    </AppShell>
  );
}

export function SettingsPage({ section }: { section: AppRole }) {
  const { profile, user, role, reload } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || name.trim().length < 2) { toast.error("Name must be at least 2 characters"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    reload();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); return; }
    setPassword("");
    toast.success("Password changed");
  }

  return (
    <AppShell section={section}>
      <PageHeader title="Settings" description="Manage your profile and account security." />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-3">
              <UserAvatar name={name || "User"} />
              <div>
                <p className="text-sm font-semibold">{profile?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{role}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </form>
        </SectionCard>
        <SectionCard title="Security">
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <Button type="submit" variant="outline" disabled={!password}>Change password</Button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}

export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Northpeak` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Northpeak` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

export function ConfirmDelete({
  task,
  onClose,
  onConfirm,
}: {
  task: Task | null;
  onClose: () => void;
  onConfirm: (task: Task) => void;
}) {
  return (
    <AlertDialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            "{task?.title}" and its subtasks and comments will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (task) onConfirm(task);
              onClose();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
