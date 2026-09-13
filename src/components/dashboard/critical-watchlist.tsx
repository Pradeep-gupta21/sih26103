"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatMeasure } from "@/components/intelligence/sla-rules-panel";
import type { SlaBreachRow, SlaRuleBreakdown } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { Cell, DataTable, TableRow } from "@/components/ui/data-table";
import { StatusChip } from "@/components/ui/status-chip";
import { formatIndian } from "@/lib/format";

const SHOWN = 6;

/** The first rows of /sla/breaches, in that endpoint's order: severity, then distance past threshold. Six shown; the raw formula sits behind a hover title. */
export function CriticalWatchlist({ rows, rules, totalProjects }: { rows: SlaBreachRow[]; rules: SlaRuleBreakdown[]; totalProjects: number }) {
  const router = useRouter();
  const shown = rows.slice(0, SHOWN);
  const ruleName = (id: string) => rules.find((r) => r.rule_key === id)?.rule_label ?? id;
  const summary = `Critical watchlist, ${shown.length} projects ordered by SLA severity then distance past threshold: ` + shown.map((r) => `${r.project_id} (${r.sector}, ${r.state}) ${r.worst_severity}, ${r.worst_rule.name} ${formatMeasure(r.worst_rule.measured_value, r.worst_rule.unit)} against ${formatMeasure(r.worst_rule.threshold, r.worst_rule.unit)}`).join("; ") + ".";
  return (
    <Panel title="Critical watchlist" subtitle="Ordered by severity, then distance past threshold. Same order as SLA monitoring." summary={summary} className="span-8"
      footer={<button type="button" className="link" onClick={() => router.push("/projects")}>View all {formatIndian(totalProjects)} projects <ArrowUpRight size={14} aria-hidden="true" /></button>}>
      {shown.length === 0 && <p className="table-note">No project breaches any rule at the current thresholds.</p>}
      {shown.length > 0 && (
        <DataTable ariaLabel="Critical watchlist" columns={[{ key: "project", label: "Project", width: "120px" }, { key: "rules", label: "Rules breached", width: "minmax(0, 1fr)" }, { key: "worst", label: "Worst breach · measured vs threshold", width: "minmax(0, 1.2fr)" }, { key: "sev", label: "Severity", width: "90px" }, { key: "open", label: "Open", srOnly: true, width: "16px" }]}>
          {shown.map((row) => (
            <TableRow key={row.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(row.project_id)}`)} ariaLabel={`Open ${row.project_id} intelligence report`}>
              <Cell><strong className="id">{row.project_id}</strong><small>{row.sector} · {row.state}</small></Cell>
              <Cell className="cell-chips">{row.breached_rules.map((id) => <StatusChip key={id} tone="neutral">{ruleName(id)}</StatusChip>)}</Cell>
              <Cell><strong>{row.worst_rule.name}</strong><small title={row.worst_rule.detail}><span className="measured-breach">{formatMeasure(row.worst_rule.measured_value, row.worst_rule.unit)}</span> vs threshold {formatMeasure(row.worst_rule.threshold, row.worst_rule.unit)}</small></Cell>
              <Cell><StatusChip tone={row.worst_severity}>{row.worst_severity}</StatusChip></Cell>
              <Cell><ArrowUpRight size={16} className="row-arrow" aria-hidden="true" /></Cell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
