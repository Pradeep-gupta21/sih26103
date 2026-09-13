"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, BellOff, CheckCircle2, ClipboardCheck, ListChecks, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMeasure } from "@/components/intelligence/sla-rules-panel";
import { SLA_RULE_IDS, getSlaBreaches, type SlaBreachListResponse, type SlaRuleId } from "@/lib/prediction-api";
import { AppShell, PageFooter } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Cell, DataTable, TableRow } from "@/components/ui/data-table";
import { TableBlockHeader } from "@/components/ui/table-block-header";
import { StatusChip } from "@/components/ui/status-chip";
import { PanelSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { formatIndian } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

/**
 * SLA rule monitoring across the registry. Everything shown is the backend's evaluation
 * of projects.csv fields against policy thresholds; this page only lays it out. The
 * counts, rows and thresholds are never computed or adjusted here.
 */

const PAGE_SIZE = 100;

export default function SlaPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="page"><div className="notice">Evaluating rules across the project registry…</div></div></main></div>}><SlaWorkspace /></Suspense>;
}

function SlaWorkspace() {
  const router = useRouter();
  // ?rule=<rule id> pre-selects a rule, so the dashboard's per-rule bars can deep-link here.
  const searchParams = useSearchParams();
  const requestedRule = searchParams.get("rule");
  const [active, setActive] = useState("SLA monitoring");
  const [data, setData] = useState<SlaBreachListResponse | null>(null);
  const [ruleFilter, setRuleFilter] = useState<SlaRuleId | null>(() => SLA_RULE_IDS.find((id) => id === requestedRule) ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassing, setShowPassing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSlaBreaches({ rule: ruleFilter, limit: PAGE_SIZE })
      .then((result) => { if (!cancelled) { setData(result); setError(null); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to evaluate SLA rules"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ruleFilter]);

  const summary = data?.summary;
  const rules = data?.rules ?? [];
  const activeRule = rules.find((rule) => rule.id === ruleFilter) ?? null;
  // The list is only shown once the response for the selected filter has arrived; a stale
  // count next to a new rule name would misstate what is being listed.
  const listReady = data !== null && (data.rule_filter ?? null) === ruleFilter;
  const exportCsv = () => { if (!listReady) return; downloadCsv(`sla-breaches${activeRule ? `-${activeRule.id}` : ""}.csv`, ["project_id", "sector", "state", "breached_rules", "rule", "measured_value", "threshold", "unit", "severity"], data.rows.map((row) => { const shown = row.filter_rule ?? row.worst_rule; return [row.project_id, row.sector, row.state, row.breached_rules.join("; "), shown.name, shown.measured_value, shown.threshold, shown.unit, shown.severity ?? ""]; })); };

  return (
    <AppShell active={active} setActive={setActive}>
      <PageHeader eyebrow="Monitoring" title="SLA rule monitoring" subtitle="Every registry project checked against policy thresholds on its recorded fields. A breach is a measured fact, not a prediction."
        controls={summary && <span className="sla-delivery"><BellOff size={13} aria-hidden="true" /> SMS escalation {summary.delivery_enabled ? "enabled" : "disabled"} · previewed, never sent</span>} />

      {error && <div className="notice notice-error" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error} <button onClick={() => window.location.reload()}>Retry</button></div>}
      {loading && !data && <div aria-busy="true"><div className="kpi-row" style={{ marginTop: 0 }}><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div><PanelSkeleton height={400} /></div>}

      {summary && <>
        <section className="kpi-row" style={{ marginTop: 0 }} aria-label="SLA summary">
          <StatCard icon={<ClipboardCheck size={18} />} label="Projects evaluated" value={formatIndian(summary.projects_evaluated)} caption="All registry records" />
          <StatCard icon={<ShieldAlert size={18} />} label="In breach" value={formatIndian(summary.projects_in_breach)} caption="Any rule over threshold" tone={summary.projects_in_breach ? "critical" : undefined} />
          <StatCard icon={<ShieldCheck size={18} />} label="Passing all rules" value={formatIndian(summary.projects_passing)} caption="No rule over threshold" />
          <StatCard icon={<ListChecks size={18} />} label="Rules in force" value={formatIndian(rules.length)} caption="Policy thresholds below" />
        </section>

        <Card className="sla-list" aria-live="polite">
          <TableBlockHeader
            title={listReady ? `${formatIndian(data.total_matching)} breaching ${data.total_matching === 1 ? "project" : "projects"}` : "Re-evaluating…"}
            subtitle={activeRule ? `${activeRule.name} · breach when > ${formatMeasure(activeRule.threshold, activeRule.unit)} · ${activeRule.description}` : "Any rule · sorted by severity, then distance past threshold"}
            onExport={listReady ? exportCsv : undefined}
            controls={<div className="segmented" role="group" aria-label="Rules and thresholds">
              <button type="button" className={ruleFilter === null ? "is-active" : ""} onClick={() => setRuleFilter(null)} aria-pressed={ruleFilter === null}>All rules <b>{formatIndian(summary.projects_in_breach)}</b></button>
              {rules.map((rule) => <button type="button" key={rule.id} className={ruleFilter === rule.id ? "is-active" : ""} onClick={() => setRuleFilter(rule.id)} aria-pressed={ruleFilter === rule.id} title={`${rule.description} · breach when > ${formatMeasure(rule.threshold, rule.unit)}`}>{rule.name} <b>{formatIndian(summary.breaches_by_rule[rule.id] ?? 0)}</b></button>)}
            </div>}
          />
          {!listReady && <PanelSkeleton height={300} />}
          {listReady && data.rows.length === 0 && <p className="table-note">{activeRule ? `No project breaches ${activeRule.name.toLowerCase()} at the current threshold.` : "No project breaches any rule at the current thresholds."}</p>}
          {listReady && data.rows.length > 0 && (
            <DataTable ariaLabel="Breaching projects" columns={[{ key: "project", label: "Project", width: "150px" }, { key: "rules", label: "Rules breached", width: "minmax(0, 1.1fr)" }, { key: "measure", label: `${activeRule ? "Filtered rule" : "Worst breach"} · measured vs threshold`, width: "minmax(0, 1.8fr)" }, { key: "sev", label: "Severity", width: "100px" }, { key: "open", label: "Open", srOnly: true, width: "16px" }]}>
              {data.rows.map((row) => { const shown = row.filter_rule ?? row.worst_rule; return (
                <TableRow key={row.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(row.project_id)}`)} ariaLabel={`Open ${row.project_id} intelligence report`}>
                  <Cell><strong className="id">{row.project_id}</strong><small>{row.sector} · {row.state}</small></Cell>
                  <Cell className="cell-chips">{row.breached_rules.map((id) => <StatusChip key={id} tone="neutral">{rules.find((rule) => rule.id === id)?.name ?? id}</StatusChip>)}</Cell>
                  <Cell><strong>{shown.name}</strong><small title={shown.detail}><span className="measured-breach">{formatMeasure(shown.measured_value, shown.unit)}</span> vs threshold {formatMeasure(shown.threshold, shown.unit)}</small></Cell>
                  <Cell><StatusChip tone={shown.severity ?? "neutral"}>{shown.severity ?? "PASS"}</StatusChip></Cell>
                  <Cell><ArrowUpRight size={16} className="row-arrow" aria-hidden="true" /></Cell>
                </TableRow>
              ); })}
            </DataTable>
          )}
          {listReady && data.total_matching > data.rows.length && <p className="table-note">Showing the {data.rows.length} most severe of {formatIndian(data.total_matching)} matching projects. Open a project from the project list to review any other record.</p>}
        </Card>

        <div style={{ marginTop: 24 }}>
          <button type="button" className="link" onClick={() => setShowPassing(!showPassing)} aria-expanded={showPassing}><CheckCircle2 size={14} aria-hidden="true" /> {showPassing ? "Hide" : "Show"} projects passing every rule ({formatIndian(summary.projects_passing)})</button>
          {showPassing && listReady && (data.passing_project_ids.length === 0 ? <p className="table-note">No project currently passes every rule.</p> : <div className="pass-chips">{data.passing_project_ids.map((id) => <button key={id} type="button" className="pill" onClick={() => router.push(`/projects/${encodeURIComponent(id)}`)}>{id} <ArrowUpRight size={12} aria-hidden="true" /></button>)}{summary.projects_passing > data.passing_project_ids.length && <span className="pass-more">+ {formatIndian(summary.projects_passing - data.passing_project_ids.length)} more</span>}</div>)}
        </div>

        <p className="analyzer-note"><ShieldAlert size={12} aria-hidden="true" style={{ verticalAlign: -2 }} /> Thresholds are policy values defined in <code>backend/app/config/sla_rules_config.py</code>. They are not model outputs and do not feed the risk model.</p>
      </>}
      <PageFooter>Evaluated from backend project records</PageFooter>
    </AppShell>
  );
}
