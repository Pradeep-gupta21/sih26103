"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PortfolioKpis } from "@/lib/prediction-api";
import { formatIndian } from "@/lib/format";

/**
 * Six absolute counts from the registry. No deltas, no shares, no sparklines: the registry
 * is a point-in-time snapshot, so any change figure would be invented.
 */
export function KpiStrip({ kpis }: { kpis: PortfolioKpis }) {
  const router = useRouter();
  const cards: { label: string; value: string; unit?: string; caption: string; href?: string; emphasis?: "warning" }[] = [
    { label: "PROJECTS TRACKED", value: formatIndian(kpis.projects_tracked), caption: "Every record in the registry" },
    { label: "RISK SIGNALS ACTIVE", value: formatIndian(kpis.risk_signals_active), caption: "Projects with a recorded risk indicator", href: "/projects?risk=high" },
    { label: "IN SLA BREACH", value: formatIndian(kpis.sla_in_breach), caption: "At least one rule over threshold", href: "/sla", emphasis: "warning" },
    { label: "COST OVERRUN", value: formatIndian(kpis.cost_overrun_total), unit: kpis.cost_overrun_unit, caption: "Revised over original sanction" },
    { label: "MEDIAN SCHEDULE OVERRUN", value: formatIndian(kpis.schedule_overrun_median_months, 1), unit: "months", caption: `Months past planned duration, over ${formatIndian(kpis.schedule_overrun_project_count)} overrunning projects` },
    { label: "MILESTONES DELAYED", value: `${formatIndian(kpis.milestones_delayed_total)} / ${formatIndian(kpis.milestones_total)}`, caption: "Across all projects" },
  ];
  return (
    <section className="overview-kpis" aria-label="Portfolio key figures">
      {cards.map((card) => {
        const body = <><span>{card.label}{card.href && <ArrowUpRight size={11} aria-hidden="true" />}</span><strong className={card.emphasis === "warning" ? "kpi-breach" : ""}>{card.value}{card.unit && <small> {card.unit}</small>}</strong><small>{card.caption}</small></>;
        return card.href
          ? <button key={card.label} className="overview-kpi overview-kpi-link" onClick={() => router.push(card.href!)} aria-label={`${card.label}: ${card.value}. ${card.caption}. Open`}>{body}</button>
          : <div key={card.label} className="overview-kpi">{body}</div>;
      })}
    </section>
  );
}
