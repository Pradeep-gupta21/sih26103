"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProjects, type ProjectRecord } from "@/lib/prediction-api";
import { RISK_SIGNAL_RULE, hasRiskSignal } from "@/lib/risk-signals";
import { AppShell, PageFooter } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cell, DataTable, TableRow } from "@/components/ui/data-table";
import { TableBlockHeader } from "@/components/ui/table-block-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatIndian } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

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
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="page"><div className="notice">Loading projects...</div></div></main></div>}><ProjectsWorkspace /></Suspense>;
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
  const clearFilter = () => router.push("/projects");
  const exportCsv = () => downloadCsv(`${riskMode ? "risk-signals" : "projects"}.csv`, ["project_id", "sector", "state", "physical_progress", "financial_progress", "milestones_delayed", "milestones_total"], filteredProjects.map(p => [p.project_id, p.sector, p.state, p.physical_progress, p.financial_progress, p.milestones_delayed, p.milestones_total]));

  return (
    <AppShell active={active}>
      <PageHeader eyebrow="National Infrastructure" title={riskMode ? "Risk signals" : "Projects"} subtitle={riskMode ? "Projects with active risk indicators from current project data." : "Select a project to open its intelligence report."} />

      {riskMode && <Card tint accent className="filter-banner" role="status" aria-live="polite"><div><span className="eyebrow"><AlertTriangle size={12} aria-hidden="true" style={{ verticalAlign: -2 }} /> Filter active · risk signals</span><p>{loading ? "Checking project records for risk indicators..." : <>Showing <strong>{formatIndian(filteredProjects.length)}</strong> of {formatIndian(projects.length)} projects with a recorded risk indicator: {RISK_SIGNAL_RULE}. These are signals from project data, not model risk scores.</>}</p></div><Button variant="secondary" onClick={clearFilter}><X size={14} aria-hidden="true" /> Clear filter</Button></Card>}
      {overrunMode && <Card tint accent className="filter-banner" role="status" aria-live="polite"><div><span className="eyebrow"><AlertTriangle size={12} aria-hidden="true" style={{ verticalAlign: -2 }} /> Filter active · schedule overrun</span><p>{loading ? "Checking project schedules..." : <>Showing <strong>{formatIndian(filteredProjects.length)}</strong> of {formatIndian(projects.length)} projects whose age past planned duration is <strong>{overrunLabel}</strong>. Measured as project_age_months minus planned_duration_months from the record itself.</>}</p></div><Button variant="secondary" onClick={clearFilter}><X size={14} aria-hidden="true" /> Clear filter</Button></Card>}

      {loading && <div className="notice">Loading projects...</div>}
      {error && <div className="notice notice-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error} <button onClick={() => window.location.reload()}>Retry</button></div>}

      {!loading && !error && <Card className="projects-list" aria-live="polite">
        <TableBlockHeader
          title={`${formatIndian(filteredProjects.length)} projects`}
          subtitle={riskMode ? "Risk signals only" : filtered ? "Filtered results" : "All available projects"}
          onExport={exportCsv}
          controls={<>
            <SearchInput value={search} onChange={setSearch} onClear={() => setSearch("")} placeholder="Search by project, sector or state" aria-label="Search projects" />
            <label className={`pill pill-select${sector ? " is-active" : ""}`}><span className="visually-hidden">Sector</span><select value={sector} onChange={event => setSector(event.target.value)} aria-label="Filter by sector"><option value="">All sectors</option>{sectors.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
            <label className={`pill pill-select${state ? " is-active" : ""}`}><span className="visually-hidden">State</span><select value={state} onChange={event => setState(event.target.value)} aria-label="Filter by state"><option value="">All states</option>{states.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
          </>}
        />
        {filteredProjects.length === 0 && <EmptyState icon={<ClipboardList size={20} />} title={riskMode && !filtered ? "No project records carry a risk indicator" : "No projects match the current filters"} hint={filtered ? "Clear the search or filters to see every project." : "The registry returned no rows for this view."} action={filtered ? <Button variant="secondary" onClick={() => { setSearch(""); setSector(""); setState(""); if (overrunMode) clearFilter(); }}>Clear filters</Button> : undefined} />}
        {filteredProjects.length > 0 && (
          <DataTable ariaLabel="Projects" columns={[{ key: "id", label: "Project", width: "120px" }, { key: "sector", label: "Sector · state", width: "minmax(0, 1.2fr)" }, { key: "progress", label: "Progress", width: "minmax(0, 1.4fr)" }, { key: "milestones", label: "Milestones delayed", width: "minmax(0, 1fr)", align: "right" }, { key: "open", label: "Open", srOnly: true, width: "16px" }]}>
            {pageRows.map(project => (
              <TableRow key={project.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(project.project_id)}`)} ariaLabel={`Open ${project.project_id} intelligence report`}>
                <Cell><strong className="id">{project.project_id}</strong></Cell>
                <Cell><strong>{project.sector}</strong><small>{project.state}</small></Cell>
                <Cell>{Math.round(project.physical_progress)}% physical · {Math.round(project.financial_progress)}% financial</Cell>
                <Cell align="right">{project.milestones_delayed} / {project.milestones_total}</Cell>
                <Cell><ArrowUpRight size={16} className="row-arrow" aria-hidden="true" /></Cell>
              </TableRow>
            ))}
          </DataTable>
        )}
        {filteredProjects.length > PAGE_SIZE && <nav className="pagination" aria-label="Project list pages"><span>Showing {formatIndian(currentPage * PAGE_SIZE + 1)}–{formatIndian(Math.min((currentPage + 1) * PAGE_SIZE, filteredProjects.length))} of {formatIndian(filteredProjects.length)}</span><div><Button variant="secondary" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page"><ChevronLeft size={14} aria-hidden="true" /> Previous</Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="secondary" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page">Next <ChevronRight size={14} aria-hidden="true" /></Button></div></nav>}
      </Card>}
      <PageFooter>Project records from backend data</PageFooter>
    </AppShell>
  );
}
