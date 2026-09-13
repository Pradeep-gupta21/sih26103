"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, PanelLeft, Search } from "lucide-react";

/**
 * The 64px bar above every page. Left: sidebar toggle, divider, project search (Enter
 * opens the project list filtered by the query -- the same route the old search panel
 * used). Right: the workspace selector and the account avatar, both of which open
 * workspace settings. There is no period control and no notification bell: neither had
 * anything real behind it.
 */
export function TopBar({ onToggleSidebar, sidebarCollapsed, before }: { onToggleSidebar: () => void; sidebarCollapsed: boolean; before?: ReactNode }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const submit = () => { const q = query.trim(); if (q) router.push(`/projects?search=${encodeURIComponent(q)}`); };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-btn" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarCollapsed}><PanelLeft size={16} /></button>
        <span className="topbar-divider" aria-hidden="true" />
        {before}
        <div className="search-input topbar-search" role="search"><Search size={14} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="Search projects, sectors, states" aria-label="Search projects" /></div>
      </div>
      <div className="topbar-right">
        <button type="button" className="workspace-select" onClick={() => router.push("/settings")} aria-label="Open National Infrastructure workspace settings">National Infrastructure <ChevronDown size={14} aria-hidden="true" /></button>
        <button type="button" className="icon-btn avatar-btn" onClick={() => router.push("/settings")} aria-label="Open Ananya Sharma profile">AS</button>
      </div>
    </header>
  );
}
