"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { getPortfolioSummary, getRecentAnalyses, type PortfolioSummary, type RecentAnalysis } from "@/lib/prediction-api";
import { AppShell, PageFooter } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { HeadlineBand } from "@/components/dashboard/headline-band";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { CostBySectorChart } from "@/components/dashboard/cost-by-sector-chart";
import { SlaRuleBars } from "@/components/dashboard/sla-rule-bars";
import { ProgressScatter } from "@/components/dashboard/progress-scatter";
import { OverrunHistogram } from "@/components/dashboard/overrun-histogram";
import { CriticalWatchlist } from "@/components/dashboard/critical-watchlist";
import { TopStatesTable } from "@/components/dashboard/top-states-table";
import { ActStrip } from "@/components/dashboard/act-strip";
import { RecentAnalyses } from "@/components/dashboard/recent-analyses";

/**
 * Portfolio overview. Two requests on load: /portfolio/summary (every aggregate, computed by
 * the backend from the registry and the same SLA evaluation /sla uses) and /analyses/recent.
 * Nothing on this page is computed client-side beyond formatting; nothing is a prediction.
 * The registry list that used to live here is at /projects.
 */

const RECENT_LIMIT = 5;

export default function DashboardPage() {
  const [active, setActive] = useState("Dashboard");
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="National Infrastructure" title="Portfolio overview" subtitle="Every figure is computed from recorded project data, not model predictions." />

      {error && <Card className="notice-error" role="alert" style={{ display: "flex", alignItems: "center", gap: 16 }}><AlertTriangle size={18} aria-hidden="true" /><div style={{ flex: 1 }}><strong>The portfolio summary could not be loaded.</strong><p style={{ margin: 0 }}>{error}</p></div><Button variant="secondary" onClick={retry}><RefreshCw size={14} aria-hidden="true" /> Retry</Button></Card>}

      {loading && !error && <div aria-busy="true" aria-label="Loading portfolio overview">
        <PanelSkeleton className="headline-band" height={80} />
        <div className="kpi-row" aria-hidden="true"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
        <div className="dash-grid"><PanelSkeleton className="span-8" height={340} /><PanelSkeleton className="span-4" height={340} /></div>
        <div className="dash-grid"><PanelSkeleton className="span-7" height={380} /><PanelSkeleton className="span-5" height={380} /></div>
        <div className="dash-grid"><PanelSkeleton className="span-8" height={400} /><PanelSkeleton className="span-4" height={400} /></div>
        <div className="dash-grid"><PanelSkeleton className="span-12" height={150} /></div>
        <div className="dash-grid"><PanelSkeleton className="span-12" height={120} /></div>
      </div>}

      {summary && !loading && !error && <>
        <HeadlineBand kpis={summary.kpis} rules={summary.sla_rule_breakdown} />
        <KpiStrip kpis={summary.kpis} />
        <div className="dash-grid">
          <CostBySectorChart rows={summary.cost_by_sector} unit={summary.kpis.cost_overrun_unit} />
          <SlaRuleBars rows={summary.sla_rule_breakdown} breachingProjects={summary.kpis.sla_in_breach} milestonesDelayed={summary.kpis.milestones_delayed_total} milestonesTotal={summary.kpis.milestones_total} />
        </div>
        <div className="dash-grid">
          <ProgressScatter data={summary.progress_divergence} />
          <OverrunHistogram buckets={summary.schedule_overrun_histogram} medianMonths={summary.kpis.schedule_overrun_median_months} overrunningProjects={summary.kpis.schedule_overrun_project_count} />
        </div>
        <div className="dash-grid">
          <CriticalWatchlist rows={summary.critical_watchlist} rules={summary.sla_rule_breakdown} totalProjects={summary.kpis.projects_tracked} />
          <TopStatesTable rows={summary.top_states} />
        </div>
        <div className="dash-grid"><ActStrip summary={summary} /></div>
        <div className="dash-grid"><RecentAnalyses rows={recent} error={recentError} /></div>
      </>}

      <PageFooter>Aggregates computed{summary ? ` ${new Date(summary.generated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""} from registry data</PageFooter>
    </AppShell>
  );
}
