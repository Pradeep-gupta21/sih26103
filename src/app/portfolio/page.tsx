"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Bell, CalendarDays, ChevronDown, ClipboardList, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "../page";
import { getProjects, type ProjectRecord } from "@/lib/prediction-api";
import { endDemoSession, useDemoDisplayName, useDemoEmail } from "@/lib/demo-auth";

/**
 * A "risk signal" is a rule on the project's own recorded fields -- not a model risk level.
 * The registry endpoint returns inputs only; the model's risk level exists solely as the
 * output of a per-project prediction, which this list never runs. Kept in one place so
 * the filter, its explanation, and the empty state cannot disagree.
 */
const RISK_SIGNAL_RULE = "at least 30% of milestones delayed, a pending land, clearance, funding or contractor issue, or a schedule deviation above 8%";
function hasRiskSignal(project: ProjectRecord): boolean {
  return project.milestones_delayed / project.milestones_total >= 0.3 || project.land_acquisition_pending || project.clearance_pending || project.funding_issue || project.contractor_issue || project.previous_schedule_deviation > 8;
}

export default function PortfolioPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="content-wrap"><div className="prediction-hint">Loading projects...</div></div></main></div>}><PortfolioWorkspace /></Suspense>;
}

function PortfolioWorkspace() {
  const router = useRouter();
  const displayName = useDemoDisplayName();
  const email = useDemoEmail();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);
  const logout = () => {
    endDemoSession();
    setUserMenuOpen(false);
    router.replace("/login");
  };
  // Read from the router, not window.location at mount: the sidebar navigates between
  // /dashboard and /dashboard?risk=high without remounting this component.
  const searchParams = useSearchParams();
  const riskMode = searchParams.get("risk") === "high";
  const active = riskMode ? "Risk signals" : "Dashboard";
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [sector, setSector] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getProjects()
      .then(records => {
        if (!cancelled) setProjects(records);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load projects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const sectors = useMemo(() => [...new Set(projects.map(project => project.sector))].sort(), [projects]);
  const states = useMemo(() => [...new Set(projects.map(project => project.state))].sort(), [projects]);
  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter(project => {
      const matchesSearch = !query || [project.project_id, project.sector, project.state].some(value => value.toLowerCase().includes(query));
      const matchesSector = !sector || project.sector === sector;
      const matchesState = !state || project.state === state;
      return matchesSearch && matchesSector && matchesState && (!riskMode || hasRiskSignal(project));
    });
  }, [projects, search, sector, state, riskMode]);

  return <div className="app-shell"><Sidebar active={active} setActive={() => undefined} /><main className="main-content"><header className="topbar"><div className="breadcrumb"><strong>{riskMode ? "RISK SIGNALS" : "DASHBOARD"}</strong></div><div className="top-actions"><button className="period" onClick={() => router.push("/settings")} aria-label="Open National Infrastructure workspace">National Infrastructure <ChevronDown size={14} /></button><button className="period" aria-label="Current reporting date"><CalendarDays size={16} /> Q3 FY 2026</button><button className="icon-only" onClick={() => setNotice(!notice)} aria-label="Notifications" aria-expanded={notice}><Bell size={18} />{notice && <span className="notification-pop" role="status">3 new signals · Review risk signals</span>}</button><div className="user-menu" ref={userMenuRef}><button className="avatar" onClick={() => setUserMenuOpen(open => !open)} aria-label={`Open ${displayName} profile`} aria-expanded={userMenuOpen}>{displayName.slice(0, 2).toUpperCase()}</button>{userMenuOpen && <div className="user-menu-dropdown"><div className="user-menu-info"><strong>{displayName}</strong><span>{email}</span></div><button className="user-menu-logout" onClick={logout}>Logout</button></div>}</div></div></header><div className="content-wrap portfolio-wrap"><header className="intro"><div><span className="eyebrow"><ClipboardList size={13} /> NATIONAL INFRASTRUCTURE</span>  <h1>{riskMode ? "Risk signals" : "Dashboard"}</h1><p>{riskMode ? "Projects with active risk indicators from current project data." : "Select a project to open its intelligence report."}</p></div></header>{riskMode && <section className="active-filter" role="status" aria-live="polite"><div><span className="eyebrow"><AlertTriangle size={13} /> FILTER ACTIVE · RISK SIGNALS</span><p>{loading ? "Checking project records for risk indicators..." : <>Showing <strong>{filteredProjects.length.toLocaleString()}</strong> of {projects.length.toLocaleString()} projects with a recorded risk indicator: {RISK_SIGNAL_RULE}. These are signals from project data, not model risk scores.</>}</p></div><button className="export-button" onClick={() => router.push("/dashboard")}><X size={14} /> Clear filter</button></section>}<section className="portfolio-toolbar" aria-label="Project filters"><div className="portfolio-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by project, sector or state" aria-label="Search projects" />{search && <button onClick={() => setSearch("")} aria-label="Clear project search"><X size={15} /></button>}</div><label><span>Sector</span><select value={sector} onChange={event => setSector(event.target.value)}><option value="">All sectors</option>{sectors.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label><label><span>State</span><select value={state} onChange={event => setState(event.target.value)}><option value="">All states</option>{states.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label></section>{loading && <div className="prediction-hint">Loading projects...</div>}{error && <div className="prediction-error" role="alert"><AlertTriangle size={15} /> {error} <button onClick={() => window.location.reload()}>Retry</button></div>}{!loading && !error && <section className="portfolio-list table-panel" aria-live="polite"><div className="portfolio-list-header"><strong>{filteredProjects.length.toLocaleString()} projects</strong><span>{riskMode ? "Risk signals only" : sector || state || search ? "Filtered results" : "All available projects"}</span></div>{filteredProjects.slice(0, 100).map(project => <button className="portfolio-row" key={project.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(project.project_id)}`)}><span className="portfolio-id">{project.project_id}</span><span><strong>{project.sector}</strong><small>{project.state}</small></span><span><small>PROGRESS</small><b>{Math.round(project.physical_progress)}% physical · {Math.round(project.financial_progress)}% financial</b></span><span><small>MILESTONES</small><b>{project.milestones_delayed}/{project.milestones_total} delayed</b></span><ArrowUpRight size={17} /></button>)}{filteredProjects.length === 0 && <div className="portfolio-empty">{riskMode && !sector && !state && !search ? "No project records carry a risk indicator." : "No projects match the current filters."}</div>}{filteredProjects.length > 100 && <div className="portfolio-empty">Showing the first 100 matching projects. Refine the search to find a specific record.</div>}</section>}<footer><span><span className="green-dot" /> AI monitoring active</span><span>Project records from backend data</span><span>PAIMANA Intelligence v2.4</span></footer></div></main></div>;
}
