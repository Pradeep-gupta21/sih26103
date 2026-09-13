"use client";

import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Archive, ClipboardList, FileSearch, Gauge, LayoutDashboard, ListChecks, LogOut, Map, Settings, ShieldCheck } from "lucide-react";
import { endDemoSession } from "@/lib/demo-auth";

/**
 * The application sidebar. Navigation targets are unchanged from the original build:
 * the two Decisions items jump to a section of the open project report, or to their own
 * "choose a project first" page when no report is open.
 */
const SECTIONS: { label: string; items: { label: string; icon: typeof LayoutDashboard; href: () => string }[] }[] = [
  { label: "Monitoring", items: [
    { label: "Dashboard", icon: LayoutDashboard, href: () => "/dashboard" },
    { label: "Projects", icon: ClipboardList, href: () => "/projects" },
    { label: "Risk signals", icon: AlertTriangle, href: () => "/projects?risk=high" },
    { label: "SLA monitoring", icon: ListChecks, href: () => "/sla" },
    { label: "Geospatial view", icon: Map, href: () => "/gis-check" },
  ] },
  { label: "Documents", items: [
    { label: "Document analyzer", icon: FileSearch, href: () => "/documents" },
    { label: "Saved analyses", icon: Archive, href: () => "/analyses" },
  ] },
  { label: "Decisions", items: [
    { label: "Interventions", icon: ShieldCheck, href: () => projectIdHref("#interventions", "/interventions") },
    { label: "Scenario lab", icon: Gauge, href: () => projectIdHref("#scenario", "/scenario") },
  ] },
];

export function Sidebar({ active, setActive, collapsed = false }: { active: string; setActive: (value: string) => void; collapsed?: boolean }) {
  const router = useRouter();
  const logout = () => { endDemoSession(); router.replace("/login"); };
  return (
    <aside className={`sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="Primary">
      <div className="brand"><span className="brand-mark"><Activity size={16} aria-hidden="true" /></span><span className="brand-word">PAIMANA<small>Intelligence</small></span></div>
      <nav>
        {SECTIONS.map((section) => (
          <div className="nav-section" key={section.label}>
            <p className="nav-label">{section.label}</p>
            {section.items.map(({ label, icon: Icon, href }) => (
              <button type="button" key={label} className={active === label ? "nav-item is-active" : "nav-item"} aria-current={active === label ? "page" : undefined} title={collapsed ? label : undefined} onClick={() => { setActive(label); router.push(href()); }}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className={active === "Workspace settings" ? "nav-item is-active" : "nav-item"} title={collapsed ? "Workspace settings" : undefined} onClick={() => router.push("/settings")}><Settings size={16} aria-hidden="true" /><span>Workspace settings</span></button>
        <button type="button" className="user-row" onClick={logout} aria-label="Sign out Ananya Sharma" title={collapsed ? "Sign out" : undefined}><span className="avatar">AS</span><span className="user-text"><strong>Ananya Sharma</strong><small>Sign out</small></span><LogOut size={14} aria-hidden="true" /></button>
      </div>
    </aside>
  );
}

/** With a project report open, a DECISIONS item jumps to its section of that report; otherwise it opens its own "choose a project first" page. */
function projectIdHref(anchor: string, fallback: string) { if (typeof window === "undefined") return fallback; const match = window.location.pathname.match(/^\/projects\/([^/]+)/); return match ? `/projects/${match[1]}${anchor}` : fallback; }
