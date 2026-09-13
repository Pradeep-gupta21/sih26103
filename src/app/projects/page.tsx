"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { getProjects, type ProjectRecord } from "@/lib/prediction-api";
import { RISK_SIGNAL_RULE, hasRiskSignal } from "@/lib/risk-signals";

/**
 * The full project registry list. This used to be /dashboard; it moved here unchanged
 * when /dashboard became the portfolio overview. Deep links carry the same query params:
 *   ?risk=high            -- only projects with a recorded risk signal (the "Risk signals" view)
 *   ?search= ?sector= ?state=
 *   ?overrun_min= ?overrun_max= ?overrun_label=  -- a schedule-overrun range, in whole months
 *                            (min inclusive, max exclusive), as handed over by the dashboard histogram
 */

const PAGE_SIZE = 50;

function readMonths(value: string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ProjectsPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="content-wrap"><div className="prediction-hint">Loading projects...</div></div></main></div>}><ProjectsWorkspace /></Suspense>;
}

function ProjectsWorkspace() {
  const router = useRouter();
  // Read from the router, not window.location at mount: the sidebar navigates between
  // /projects and /projects?risk=high without remounting this component.
  const searchParams = useSearchParams();
  const riskMode = searchParams.get("risk") === "high";
  const overrunMin = readMonths(searchParams.get("overrun_min"));
  const overrunMax = readMonths(searchParams.get("overrun_max"));
  const overrunMode = overrunMin !== null || overrunMax !== null;
  const overrunLabel = searchParams.get("overrun_label") ?? [overrunMin !== null ? `from ${overrunMin}` : null, overrunMax !== null ? `under ${overrunMax}` : null].filter(Boolean).join(" ") + " months";
  const active = riskMode ? "Risk signals" : "Projects";
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [sector, setSector] = useState(() => searchParams.get("sector") ?? "");
  const [state, setState] = useState(() => searchParams.get("state") ?? "");
  // The page index is remembered together with the filters it was chosen under, so any
  // filter change lands back on the first page without an effect.
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: "", page: 0 });
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
      const overrun = project.project_age_months - project.planned_duration_months;
      const matchesOverrun = !overrunMode || ((overrunMin === null || overrun >= overrunMin) && (overrunMax === null || overrun < overrunMax));
      return matchesSearch && matchesSector && matchesState && matchesOverrun && (!riskMode || hasRiskSignal(project));
    });
  }, [projects, search, sector, state, riskMode, overrunMode, overrunMin, overrunMax]);

  const filterKey = JSON.stringify([search, sector, state, riskMode, overrunMin, overrunMax]);
  const setPage = (page: number) => setPageState({ key: filterKey, page });
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(pageState.key === filterKey ? pageState.page : 0, pageCount - 1);
  const pageRows = filteredProjects.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const filtered = Boolean(sector || state || search || overrunMode);

  return <div className="app-shell"><Sidebar active={active} setActive={() => undefined} /><main className="main-content"><TopBar title={riskMode ? "RISK SIGNALS" : "PROJECTS"} actions={<><button className="period" onClick={() => router.push("/settings")} aria-label="Open National Infrastructure workspace">National Infrastructure <ChevronDown size={14} /></button><button className="period" aria-label="Current reporting date"><CalendarDays size={16} /> Q3 FY 2026</button><button className="icon-only" onClick={() => setNotice(!notice)} aria-label="Notifications" aria-expanded={notice}><Bell size={18} />{notice && <span className="notification-pop" role="status">3 new signals · Review risk signals</span>}</button><button className="avatar" onClick={() => router.push("/settings")} aria-label="Open Ananya Sharma profile">AS</button></>} /><div className="content-wrap portfolio-wrap"><header className="intro"><div><span className="eyebrow"><ClipboardList size={13} /> NATIONAL INFRASTRUCTURE</span>  <h1>{riskMode ? "Risk signals" : "Projects"}</h1><p>{riskMode ? "Projects with active risk indicators from current project data." : "Select a project to open its intelligence report."}</p></div></header>{riskMode && <section className="active-filter" role="status" aria-live="polite"><div><span className="eyebrow"><AlertTriangle size={13} /> FILTER ACTIVE · RISK SIGNALS</span><p>{loading ? "Checking project records for risk indicators..." : <>Showing <strong>{filteredProjects.length.toLocaleString()}</strong> of {projects.length.toLocaleString()} projects with a recorded risk indicator: {RISK_SIGNAL_RULE}. These are signals from project data, not model risk scores.</>}</p></div><button className="export-button" onClick={() => router.push("/projects")}><X size={14} /> Clear filter</button></section>}{overrunMode && <section className="active-filter" role="status" aria-live="polite"><div><span className="eyebrow"><AlertTriangle size={13} /> FILTER ACTIVE · SCHEDULE OVERRUN</span><p>{loading ? "Checking project schedules..." : <>Showing <strong>{filteredProjects.length.toLocaleString()}</strong> of {projects.length.toLocaleString()} projects whose age past planned duration is <strong>{overrunLabel}</strong>. Measured as project_age_months minus planned_duration_months from the record itself.</>}</p></div><button className="export-button" onClick={() => router.push("/projects")}><X size={14} /> Clear filter</button></section>}<section className="portfolio-toolbar" aria-label="Project filters"><div className="portfolio-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by project, sector or state" aria-label="Search projects" />{search && <button onClick={() => setSearch("")} aria-label="Clear project search"><X size={15} /></button>}</div><label><span>Sector</span><select value={sector} onChange={event => setSector(event.target.value)}><option value="">All sectors</option>{sectors.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label><label><span>State</span><select value={state} onChange={event => setState(event.target.value)}><option value="">All states</option>{states.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></label></section>{loading && <div className="prediction-hint">Loading projects...</div>}{error && <div className="prediction-error" role="alert"><AlertTriangle size={15} /> {error} <button onClick={() => window.location.reload()}>Retry</button></div>}{!loading && !error && <section className="portfolio-list table-panel" aria-live="polite"><div className="portfolio-list-header"><strong>{filteredProjects.length.toLocaleString()} projects</strong><span>{riskMode ? "Risk signals only" : filtered ? "Filtered results" : "All available projects"}</span></div>{pageRows.map(project => <button className="portfolio-row" key={project.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(project.project_id)}`)}><span className="portfolio-id">{project.project_id}</span><span><strong>{project.sector}</strong><small>{project.state}</small></span><span><small>PROGRESS</small><b>{Math.round(project.physical_progress)}% physical · {Math.round(project.financial_progress)}% financial</b></span><span><small>MILESTONES</small><b>{project.milestones_delayed}/{project.milestones_total} delayed</b></span><ArrowUpRight size={17} /></button>)}{filteredProjects.length === 0 && <div className="portfolio-empty">{riskMode && !filtered ? "No project records carry a risk indicator." : "No projects match the current filters."}</div>}{filteredProjects.length > PAGE_SIZE && <nav className="portfolio-pagination" aria-label="Project list pages"><span>Showing {(currentPage * PAGE_SIZE + 1).toLocaleString()}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredProjects.length).toLocaleString()} of {filteredProjects.length.toLocaleString()}</span><div><button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page"><ChevronLeft size={14} /> Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page">Next <ChevronRight size={14} /></button></div></nav>}</section>}<footer><span><span className="green-dot" /> AI monitoring active</span><span>Project records from backend data</span><span>PAIMANA Intelligence v2.4</span></footer></div></main></div>;
}
