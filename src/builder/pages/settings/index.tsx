import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/builder/layout/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/cards/section-card";
import { UserAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { SettingsPageProps } from "./interface";

export function SettingsPage({ section }: SettingsPageProps) {
  const { profile, user, role, reload } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({ name: name.trim() });
      toast.success("Profile updated");
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await api.updateProfile({ password });
      setPassword("");
      toast.success("Password changed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      toast.error(message);
    }
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
            <Button type="submit" disabled={saving} loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </SectionCard>
        <SectionCard title="Security">
          <form onSubmit={savePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!password}>
              Change password
            </Button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}

export default SettingsPage;
export type { SettingsPageProps } from "./interface";
