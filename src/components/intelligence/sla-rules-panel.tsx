"use client";

/**
 * SLA rule monitoring for one project: every rule, its policy threshold, the project's
 * measured value, and pass/breach -- side by side, so nobody has to ask what tripped a
 * flag. The values arrive already computed by the backend from the project's own
 * recorded fields; nothing here is a prediction and nothing is derived client-side.
 *
 * The alert preview is exactly that: what an escalation would say. It is never sent.
 */

import { BellOff, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ProjectSlaReport, SlaRuleResult } from "@/lib/prediction-api";
import { StatusChip } from "@/components/ui/status-chip";

export function formatMeasure(value: number, unit: string): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return unit === "%" ? `${rounded}%` : `${rounded} ${unit}`;
}

export function severityClass(severity: SlaRuleResult["severity"]): string {
  return severity === "CRITICAL" ? "critical" : severity === "WARNING" ? "high" : "stable";
}

/** The severity chip used on /sla and the dashboard watchlist: colour plus the word, never colour alone. */
export function SeverityChip({ severity, className = "" }: { severity: SlaRuleResult["severity"]; className?: string }) {
  return <StatusChip tone={severityClass(severity)} className={className}>{severity ?? "PASS"}</StatusChip>;
}

export function SlaRulesPanel({ report, error, loading }: { report: ProjectSlaReport | null; error?: string | null; loading?: boolean }) {
  return (
    <section className="sla-rules-section report-section">
      <div className="report-title">
        <span className="section-number">06</span>
        <div>
          <span className="eyebrow">SLA RULE MONITORING</span>
          <h2>Is this project within policy thresholds?</h2>
          <p>Deterministic checks on the project&apos;s recorded fields against configurable policy thresholds. Measured facts, separate from the risk model.</p>
        </div>
        {report && (
          <StatusChip tone={report.overall_status === "PASS" ? "stable" : severityClass(report.worst_severity)}>
            {report.overall_status === "PASS" ? "ALL RULES PASS" : `${report.breached_rules} OF ${report.evaluated_rules} BREACHED`}
          </StatusChip>
        )}
      </div>

      {loading && <div className="prediction-hint">Evaluating SLA rules…</div>}
      {error && <div className="prediction-error" role="alert">{error}</div>}

      {report && (
        <>
          <div className="sla-rule-table">
            <div className="sla-rule-head" aria-hidden="true"><span>RULE</span><span>MEASURED</span><span>THRESHOLD</span><span>STATUS</span></div>
            {report.results.map((result) => (
              <div className={`sla-rule-row${result.breached ? " breached" : ""}`} key={result.rule_id}>
                <div><strong>{result.name}</strong><small>{result.detail}</small></div>
                <b className={result.breached ? "measured-breach" : ""}>{formatMeasure(result.measured_value, result.unit)}</b>
                <span>&gt; {formatMeasure(result.threshold, result.unit)}<small>policy threshold</small></span>
                <StatusChip tone={result.breached ? severityClass(result.severity) : "stable"}>{result.breached ? result.severity : "PASS"}</StatusChip>
              </div>
            ))}
          </div>

          {report.alert_preview ? (
            <div className="sla-alert-preview" role="note" aria-label="Alert preview, not dispatched">
              <div className="sla-alert-head">
                <span className="eyebrow"><ShieldAlert size={13} /> ESCALATION PREVIEW</span>
                <span className="sla-not-sent"><BellOff size={12} /> NOT DISPATCHED · SMS delivery {report.alert_preview.delivery_enabled ? "enabled" : "disabled"} · recipient {report.alert_preview.recipient_configured ? "configured" : "not configured"}</span>
              </div>
              <dl>
                <div><dt>RECIPIENT ROLE</dt><dd>{report.alert_preview.recipient_role}</dd></div>
                <div><dt>RULE BREACHED</dt><dd>{report.alert_preview.rule_name}</dd></div>
                <div><dt>PROJECT</dt><dd>{report.alert_preview.project_id}</dd></div>
                <div><dt>MEASURED VS THRESHOLD</dt><dd>{formatMeasure(report.alert_preview.measured_value, report.alert_preview.unit)} vs {formatMeasure(report.alert_preview.threshold, report.alert_preview.unit)}</dd></div>
              </dl>
              <p>{report.alert_preview.message}</p>
            </div>
          ) : (
            <div className="sla-pass-note"><CheckCircle2 size={15} /> Every rule passes for this project. No escalation would be raised.</div>
          )}
        </>
      )}
    </section>
  );
}
