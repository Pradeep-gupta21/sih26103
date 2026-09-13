"use client";

import { AlertTriangle, ClipboardList, ListChecks, Milestone } from "lucide-react";
import type { PortfolioKpis } from "@/lib/prediction-api";
import { StatCard } from "@/components/ui/stat-card";
import { formatIndian } from "@/lib/format";

/**
 * Four absolute counts from the registry. No deltas, no shares, no sparklines: the registry
 * is a point-in-time snapshot, so any change figure would be invented. Cost overrun sits in
 * the headline band; the median schedule overrun sits with the schedule chart.
 */
export function KpiStrip({ kpis }: { kpis: PortfolioKpis }) {
  return (
    <section className="kpi-row" aria-label="Portfolio key figures">
      <StatCard icon={<ClipboardList size={18} />} label="Projects tracked" value={formatIndian(kpis.projects_tracked)} caption="All registry records" />
      <StatCard icon={<AlertTriangle size={18} />} label="Risk signals" value={formatIndian(kpis.risk_signals_active)} caption="Recorded risk indicator" href="/projects?risk=high" />
      <StatCard icon={<ListChecks size={18} />} label="SLA breaches" value={formatIndian(kpis.sla_in_breach)} caption="Any rule over threshold" href="/sla" tone="critical" />
      <StatCard icon={<Milestone size={18} />} label="Milestones delayed" value={formatIndian(kpis.milestones_delayed_total)} caption={`Of ${formatIndian(kpis.milestones_total)} recorded`} />
    </section>
  );
}
