"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SlaRuleBreakdown } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

/**
 * One bar per SLA rule, as plain HTML so every bar is a focusable link to /sla?rule=<id>.
 * The count and the threshold are printed beside each bar; the bar length is only a visual
 * restatement of the count. Rust is used here because these are breach counts.
 */
export function SlaRuleBars({ rows, breachingProjects }: { rows: SlaRuleBreakdown[]; breachingProjects: number }) {
  const router = useRouter();
  const max = Math.max(1, ...rows.map((r) => r.breach_count));
  const summary = `SLA breaches by rule: ` + rows.map((r) => `${r.rule_label} ${formatIndian(r.breach_count)} projects (threshold ${r.threshold_label})`).join("; ") + `. ${formatIndian(breachingProjects)} distinct projects breach at least one rule.`;
  return (
    <Panel eyebrow="COMPLIANCE" title="SLA breaches by rule" summary={summary} caption={<>A project may breach more than one rule, so these counts sum to more than the <b>{formatIndian(breachingProjects)}</b> breaching projects. Thresholds are the policy values in force on the SLA monitoring page.</>}>
      <ul className="overview-rule-bars">
        {rows.map((r) => (
          <li key={r.rule_key}>
            <button onClick={() => router.push(`/sla?rule=${encodeURIComponent(r.rule_key)}`)} aria-label={`${r.rule_label}: ${formatIndian(r.breach_count)} projects in breach, threshold ${r.threshold_label}. Open on SLA monitoring`}>
              <span className="overview-rule-label"><strong>{r.rule_label}</strong><small>breach when {r.threshold_label}</small></span>
              <span className="overview-rule-track"><i style={{ width: `${(r.breach_count / max) * 100}%` }} /></span>
              <span className="overview-rule-count">{formatIndian(r.breach_count)}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
