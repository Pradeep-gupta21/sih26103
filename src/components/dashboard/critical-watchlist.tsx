"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { SeverityChip, formatMeasure } from "@/components/intelligence/sla-rules-panel";
import type { SlaBreachRow, SlaRuleBreakdown } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

/** The first rows of /sla/breaches, in that endpoint's order: severity, then distance past threshold. */
export function CriticalWatchlist({ rows, rules, totalProjects }: { rows: SlaBreachRow[]; rules: SlaRuleBreakdown[]; totalProjects: number }) {
  const router = useRouter();
  const ruleName = (id: string) => rules.find((r) => r.rule_key === id)?.rule_label ?? id;
  const summary = `Critical watchlist, ${rows.length} projects ordered by SLA severity then distance past threshold: ` + rows.map((r) => `${r.project_id} (${r.sector}, ${r.state}) ${r.worst_severity}, ${r.worst_rule.name} ${formatMeasure(r.worst_rule.measured_value, r.worst_rule.unit)} against ${formatMeasure(r.worst_rule.threshold, r.worst_rule.unit)}`).join("; ") + ".";
  return (
    <Panel eyebrow="PRIORITY" title="Critical watchlist" summary={summary} className="overview-panel-full overview-panel-table" aside={<span className="overview-panel-note">Ordered by severity, then distance past threshold · same order as SLA monitoring</span>}>
      {rows.length === 0 && <div className="portfolio-empty">No project breaches any rule at the current thresholds.</div>}
      {rows.length > 0 && <div className="sla-list-head" aria-hidden="true"><span>PROJECT</span><span>RULES BREACHED</span><span>WORST BREACH · MEASURED VS THRESHOLD</span><span>SEVERITY</span><span /></div>}
      {rows.map((row) => (
        <button className="sla-row" key={row.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(row.project_id)}`)} aria-label={`Open ${row.project_id} intelligence report`}>
          <span><strong className="portfolio-id">{row.project_id}</strong><small>{row.sector} · {row.state}</small></span>
          <span className="sla-row-rules">{row.breached_rules.map((id) => <i key={id}>{ruleName(id)}</i>)}</span>
          <span className="sla-row-measure"><strong>{row.worst_rule.name}</strong><b><span className="measured-breach">{formatMeasure(row.worst_rule.measured_value, row.worst_rule.unit)}</span> vs threshold {formatMeasure(row.worst_rule.threshold, row.worst_rule.unit)}</b><small>{row.worst_rule.detail}</small></span>
          <SeverityChip severity={row.worst_severity} />
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      ))}
      <div className="overview-panel-footer"><button className="text-button" onClick={() => router.push("/projects")}>View all {formatIndian(totalProjects)} projects <ArrowUpRight size={13} /></button></div>
    </Panel>
  );
}
