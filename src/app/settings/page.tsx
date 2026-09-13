"use client";

import { useState } from "react";
import { Check, Settings } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  const [active, setActive] = useState("Workspace settings");
  const [saved, setSaved] = useState(false);
  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Workspace" title="Workspace settings" subtitle="Manage the local workspace preferences used by this interface." />
      <Card><EmptyState icon={<Settings size={20} />} title="National Infrastructure" hint="Portfolio director access is active for Ananya Sharma. Authentication and persistence are not connected in this environment." action={<Button variant="primary" onClick={() => setSaved(true)}>{saved ? <><Check size={14} aria-hidden="true" /> Settings acknowledged</> : "Save workspace state"}</Button>} /></Card>
    </AppShell>
  );
}
