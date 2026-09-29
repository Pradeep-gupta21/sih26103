"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

/** Sidebar + top bar + page container. Every page renders inside one of these. */
export function AppShell({ active, setActive, before, wide = false, children }: { active: string; setActive?: (value: string) => void; before?: ReactNode; wide?: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar active={active} setActive={setActive ?? (() => undefined)} collapsed={collapsed} />
      <main className="main-content">
        <TopBar onToggleSidebar={() => setCollapsed((value) => !value)} sidebarCollapsed={collapsed} before={before} />
        <div className={`page${wide ? " page-wide" : ""}`}>{children}</div>
      </main>
    </div>
  );
}

/** The muted provenance line at the foot of every page. */
export function PageFooter({ children }: { children: ReactNode }) {
  return <footer className="page-foot"><span>{children}</span><span>PAIMANA Intelligence v2.4</span></footer>;
}
