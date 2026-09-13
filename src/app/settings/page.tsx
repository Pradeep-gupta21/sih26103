"use client";

import { useState } from "react";
import { Check, Settings } from "lucide-react";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  const [active, setActive] = useState("Workspace settings");
  const [saved, setSaved] = useState(false);
  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="WORKSPACE SETTINGS" /><div className="content-wrap"><header className="intro"><div><span className="eyebrow"><Settings size={13} /> WORKSPACE</span><h1>Workspace settings</h1><p>Manage the local workspace preferences used by this interface.</p></div></header><EmptyState icon={<Settings size={17} />} eyebrow="WORKSPACE PROFILE" title="National Infrastructure" actions={<button className="dark-button" onClick={() => setSaved(true)}>{saved ? <><Check size={14} /> Settings acknowledged</> : "Save workspace state"}</button>}><p>Portfolio director access is active for Ananya Sharma. Authentication and persistence are not connected in this environment.</p></EmptyState></div></main></div>;
}
