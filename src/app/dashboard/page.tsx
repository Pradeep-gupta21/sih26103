"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, CalendarDays, ChevronDown, ClipboardList, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { getPortfolioSummary, getRecentAnalyses, type PortfolioSummary, type RecentAnalysis } from "@/lib/prediction-api";
import { CostBySectorChart } from "@/components/dashboard/cost-by-sector-chart";
import { CriticalWatchlist } from "@/components/dashboard/critical-watchlist";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { OverrunHistogram } from "@/components/dashboard/overrun-histogram";
import { PanelSkeleton } from "@/components/ui/panel";
import { ProgressScatter } from "@/components/dashboard/progress-scatter";
import { RecentAnalyses } from "@/components/dashboard/recent-analyses";
import { SlaRuleBars } from "@/components/dashboard/sla-rule-bars";
import { TopStatesTable } from "@/components/dashboard/top-states-table";

/**
 * Portfolio overview. Two requests on load: /portfolio/summary (every aggregate, computed by
 * the backend from the registry and the same SLA evaluation /sla uses) and /analyses/recent.
 * Nothing on this page is computed client-side beyond formatting; nothing is a prediction.
 * The registry list that used to live here is at /projects.
 */

const RECENT_LIMIT = 5;

export default function DashboardPage() {
  const router = useRouter();
  const [active, setActive] = useState("Dashboard");
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  // The summary decides whether the page renders at all; recent analyses only decide one panel.
  // State is only written from the response callbacks, never synchronously inside the effect.
  const load = useCallback(() => {
    let cancelled = false;
    getPortfolioSummary()
      .then((result) => { if (!cancelled) setSummary(result); })
      .catch((reason) => { if (!cancelled) { setSummary(null); setError(reason instanceof Error ? reason.message : "Unable to load the portfolio summary"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    getRecentAnalyses(RECENT_LIMIT)
      .then((rows) => { if (!cancelled) { setRecent(rows); setRecentError(null); } })
      .catch((reason) => { if (!cancelled) setRecentError(reason instanceof Error ? reason.message : "Unable to load recent analyses"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);
  const retry = () => { setLoading(true); setError(null); load(); };

  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="DASHBOARD" actions={<><button className="period" onClick={() => router.push("/settings")} aria-label="Open National Infrastructure workspace">National Infrastructure <ChevronDown size={14} /></button><button className="period" aria-label="Current reporting date"><CalendarDays size={16} /> Q3 FY 2026</button><button className="icon-only" onClick={() => setNotice(!notice)} aria-label="Notifications" aria-expanded={notice}><Bell size={18} />{notice && <span className="notification-pop" role="status">3 new signals · Review risk signals</span>}</button><button className="avatar" onClick={() => router.push("/settings")} aria-label="Open Ananya Sharma profile">AS</button></>} /><div className="content-wrap overview-wrap-dashboard">
    <header className="intro"><div><span className="eyebrow"><ClipboardList size={13} /> NATIONAL INFRASTRUCTURE</span><h1>Portfolio overview</h1><p>Aggregate position across every project in the registry. All figures are computed from recorded project data, not model predictions.</p></div></header>

    {error && <section className="overview-panel overview-panel-full overview-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><div><strong>The portfolio summary could not be loaded.</strong><p>{error}</p></div><button className="export-button" onClick={retry}><RefreshCw size={14} /> Retry</button></section>}

    {loading && !error && <div className="overview-grid" aria-busy="true" aria-label="Loading portfolio overview">
      <section className="overview-kpis overview-skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div className="overview-kpi" key={i}><span className="skeleton-line" style={{ width: 110 }} /><span className="skeleton-line" style={{ width: 80, height: 26 }} /><span className="skeleton-line" style={{ width: 140 }} /></div>)}</section>
      <PanelSkeleton className="overview-panel-full" height={428} /><PanelSkeleton height={340} /><PanelSkeleton height={340} /><PanelSkeleton height={280} /><PanelSkeleton height={280} /><PanelSkeleton className="overview-panel-full" height={420} /><PanelSkeleton className="overview-panel-full" height={140} />
    </div>}

    {summary && !loading && !error && <div className="overview-grid">
      <KpiStrip kpis={summary.kpis} />
      <CostBySectorChart rows={summary.cost_by_sector} unit={summary.kpis.cost_overrun_unit} />
      <ProgressScatter data={summary.progress_divergence} />
      <SlaRuleBars rows={summary.sla_rule_breakdown} breachingProjects={summary.kpis.sla_in_breach} />
      <OverrunHistogram buckets={summary.schedule_overrun_histogram} />
      <TopStatesTable rows={summary.top_states} />
      <CriticalWatchlist rows={summary.critical_watchlist} rules={summary.sla_rule_breakdown} totalProjects={summary.kpis.projects_tracked} />
      <RecentAnalyses rows={recent} error={recentError} />
    </div>}

    <footer><span><span className="green-dot" /> AI monitoring active</span><span>Aggregates computed from registry data{summary ? ` · ${new Date(summary.generated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</span><span>PAIMANA Intelligence v2.4</span></footer>
  </div></main></div>;
}
