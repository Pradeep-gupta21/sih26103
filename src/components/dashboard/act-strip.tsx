"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PortfolioSummary } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

/**
 * Three one-line statements derived from aggregates the page already holds, each with a
 * link into an existing page. Nothing here is computed beyond picking the largest value
 * from an array the API returned. An unavailable aggregate drops its row.
 */
export function ActStrip({ summary }: { summary: PortfolioSummary }) {
  const router = useRouter();
  const worstSector = summary.cost_by_sector.length ? summary.cost_by_sector.reduce((a, b) => (b.revised_cost_sum - b.original_cost_sum) > (a.revised_cost_sum - a.original_cost_sum) ? b : a) : null;
  const worstRule = summary.sla_rule_breakdown.length ? summary.sla_rule_breakdown.reduce((a, b) => b.breach_count > a.breach_count ? b : a) : null;
  const worstProject = summary.critical_watchlist[0] ?? null;
  const unit = summary.kpis.cost_overrun_unit;
  const items: { key: string; text: React.ReactNode; label: string; href: string }[] = [];
  if (worstSector) items.push({ key: "sector", text: <><b>{worstSector.sector}</b> carries the largest recorded escalation: <b>{formatIndian(worstSector.revised_cost_sum - worstSector.original_cost_sum)} {unit}</b> across {formatIndian(worstSector.project_count)} projects.</>, label: `Open ${worstSector.sector} projects`, href: `/projects?sector=${encodeURIComponent(worstSector.sector)}` });
  if (worstRule) items.push({ key: "rule", text: <><b>{worstRule.rule_label}</b> is the most-breached rule: <b>{formatIndian(worstRule.breach_count)}</b> projects past {worstRule.threshold_label}.</>, label: "Review breaches", href: `/sla?rule=${encodeURIComponent(worstRule.rule_key)}` });
  if (worstProject) items.push({ key: "project", text: <><b>{worstProject.project_id}</b> ({worstProject.sector}, {worstProject.state}) is the most severe breach: {worstProject.worst_rule.name.toLowerCase()} at <b>{formatIndian(worstProject.worst_rule.measured_value, 1)} {worstProject.worst_rule.unit}</b>.</>, label: "Open intelligence report", href: `/projects/${encodeURIComponent(worstProject.project_id)}` });
  if (items.length === 0) return null;
  return (
    <Panel title="Act on this" subtitle="The largest single contributor in each aggregate above, with a direct route in." summary={`Act on this: ${items.length} items.`} className="span-12">
      <div className="act-list">
        {items.map((item) => <div className="act-row" key={item.key}><span>{item.text}</span><button type="button" className="link" onClick={() => router.push(item.href)}>{item.label} <ArrowUpRight size={14} aria-hidden="true" /></button></div>)}
      </div>
    </Panel>
  );
}
