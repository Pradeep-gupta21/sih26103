"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, BellOff, CheckCircle2, ListChecks, ShieldAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/topbar";
import { SeverityChip, formatMeasure } from "@/components/intelligence/sla-rules-panel";
import { SLA_RULE_IDS, getSlaBreaches, type SlaBreachListResponse, type SlaRuleId } from "@/lib/prediction-api";

/**
 * SLA rule monitoring across the registry. Everything shown is the backend's evaluation
 * of projects.csv fields against policy thresholds; this page only lays it out. The
 * counts, rows and thresholds are never computed or adjusted here.
 */

const PAGE_SIZE = 100;

export default function SlaPage() {
  return <Suspense fallback={<div className="app-shell"><main className="main-content"><div className="content-wrap"><div className="prediction-hint">Evaluating rules across the project registry…</div></div></main></div>}><SlaWorkspace /></Suspense>;
}

function SlaWorkspace() {
  const router = useRouter();
  // ?rule=<rule id> pre-selects a rule card, so the dashboard's per-rule bars can deep-link here.
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

  return <div className="app-shell"><Sidebar active={active} setActive={setActive} /><main className="main-content"><TopBar title="SLA MONITORING" /><div className="content-wrap">
    <header className="intro"><div><span className="eyebrow"><ListChecks size={13} /> MONITORING</span><h1>SLA rule monitoring</h1><p>Every registry project checked against configurable policy thresholds on its own recorded fields. A breach is a measured fact, not a model prediction.</p></div>{summary && <span className={`sla-delivery ${summary.delivery_enabled ? "on" : "off"}`}><BellOff size={13} /> SMS escalation {summary.delivery_enabled ? "enabled" : "disabled"} · alerts are previewed, never sent</span>}</header>

    {error && <div className="prediction-error" role="alert"><AlertTriangle size={15} /> {error} <button onClick={() => window.location.reload()}>Retry</button></div>}
    {loading && !data && <div className="prediction-hint">Evaluating 5 rules across the project registry…</div>}

    {summary && <>
      <section className="metric-strip sla-metrics" aria-label="SLA summary">
        <div className="metric"><span>PROJECTS EVALUATED</span><strong>{summary.projects_evaluated.toLocaleString()}</strong><small>Every record in the registry</small></div>
        <div className="metric"><span>IN BREACH</span><strong className={summary.projects_in_breach ? "orange-text" : ""}>{summary.projects_in_breach.toLocaleString()}</strong><small>At least one rule over threshold</small></div>
        <div className="metric"><span>PASSING ALL RULES</span><strong>{summary.projects_passing.toLocaleString()}</strong><small>No rule over threshold</small></div>
        <div className="metric"><span>RULES IN FORCE</span><strong>{rules.length}</strong><small>Policy thresholds, see below</small></div>
      </section>

      <section className="sla-rule-cards" aria-label="Rules and thresholds">
        <button className={`sla-rule-card${ruleFilter === null ? " active" : ""}`} onClick={() => setRuleFilter(null)} aria-pressed={ruleFilter === null}><span className="eyebrow">ALL RULES</span><strong>{summary.projects_in_breach.toLocaleString()}</strong><small>projects in breach of any rule</small></button>
        {rules.map((rule) => <button className={`sla-rule-card${ruleFilter === rule.id ? " active" : ""}`} key={rule.id} onClick={() => setRuleFilter(rule.id)} aria-pressed={ruleFilter === rule.id}><span className="eyebrow">{rule.name.toUpperCase()}</span><strong>{(summary.breaches_by_rule[rule.id] ?? 0).toLocaleString()}</strong><small>breach when &gt; {formatMeasure(rule.threshold, rule.unit)}</small><em>{rule.description}</em></button>)}
      </section>

      {!listReady && <div className="prediction-hint">Re-evaluating{activeRule ? ` ${activeRule.name.toLowerCase()}` : ""} across the registry…</div>}
      {listReady && <section className="portfolio-list table-panel sla-list" aria-live="polite">
        <div className="portfolio-list-header"><strong>{data.total_matching.toLocaleString()} breaching {data.total_matching === 1 ? "project" : "projects"}{activeRule ? ` · ${activeRule.name}` : ""}</strong><span>{activeRule ? `Filtered: ${activeRule.name} > ${formatMeasure(activeRule.threshold, activeRule.unit)} · ` : ""}Sorted by severity, then distance past threshold</span></div>
        {data.rows.length === 0 && <div className="portfolio-empty">{activeRule ? `No project breaches ${activeRule.name.toLowerCase()} at the current threshold.` : "No project breaches any rule at the current thresholds."}</div>}
        {data.rows.length > 0 && <div className="sla-list-head" aria-hidden="true"><span>PROJECT</span><span>RULES BREACHED</span><span>{activeRule ? "FILTERED RULE" : "WORST BREACH"} · MEASURED VS THRESHOLD</span><span>SEVERITY</span><span /></div>}
        {data.rows.map((row) => { const shown = row.filter_rule ?? row.worst_rule; return <button className="sla-row" key={row.project_id} onClick={() => router.push(`/projects/${encodeURIComponent(row.project_id)}`)} aria-label={`Open ${row.project_id} intelligence report`}>
          <span><strong className="portfolio-id">{row.project_id}</strong><small>{row.sector} · {row.state}</small></span>
          <span className="sla-row-rules">{row.breached_rules.map((id) => <i key={id}>{rules.find((rule) => rule.id === id)?.name ?? id}</i>)}</span>
          <span className="sla-row-measure"><strong>{shown.name}</strong><b><span className="measured-breach">{formatMeasure(shown.measured_value, shown.unit)}</span> vs threshold {formatMeasure(shown.threshold, shown.unit)}</b><small>{shown.detail}</small></span>
          <SeverityChip severity={shown.severity} />
          <ArrowUpRight size={17} />
        </button>; })}
        {data.total_matching > data.rows.length && <div className="portfolio-empty">Showing the {data.rows.length} most severe of {data.total_matching.toLocaleString()} matching projects. Open a project from the dashboard to review any other record.</div>}
      </section>}

      <section className="sla-passing">
        <button className="text-button" onClick={() => setShowPassing(!showPassing)} aria-expanded={showPassing}><CheckCircle2 size={14} /> {showPassing ? "Hide" : "Show"} projects passing every rule ({summary.projects_passing.toLocaleString()})</button>
        {showPassing && (data.passing_project_ids.length === 0 ? <div className="portfolio-empty">No project currently passes every rule.</div> : <div className="sla-passing-grid">{data.passing_project_ids.map((id) => <button key={id} className="sla-pass-chip" onClick={() => router.push(`/projects/${encodeURIComponent(id)}`)}>{id} <ArrowUpRight size={12} /></button>)}{summary.projects_passing > data.passing_project_ids.length && <span className="sla-pass-more">+ {(summary.projects_passing - data.passing_project_ids.length).toLocaleString()} more</span>}</div>)}
      </section>

      <p className="analyzer-note"><ShieldAlert size={12} /> Thresholds are policy values defined in <code>backend/app/config/sla_rules_config.py</code>. They are not model outputs and do not feed the risk model.</p>
    </>}
    <footer><span><span className="green-dot" /> AI monitoring active</span><span>Evaluated from backend project records</span><span>PAIMANA Intelligence v2.4</span></footer>
  </div></main></div>;
}
