"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SlaRuleBreakdown } from "@/lib/prediction-api";
import { Panel } from "@/components/ui/panel";
import { formatIndian } from "@/lib/format";

/**
 * One row per SLA rule, as plain HTML so every row is a focusable link to /sla?rule=<id>.
 * The bar is a visual restatement of the printed count. The milestones-delayed figure is
 * annotated on the milestone slippage row.
 */
export function SlaRuleBars({ rows, breachingProjects, milestonesDelayed, milestonesTotal }: { rows: SlaRuleBreakdown[]; breachingProjects: number; milestonesDelayed: number; milestonesTotal: number }) {
  const router = useRouter();
  const max = Math.max(1, ...rows.map((r) => r.breach_count));
  const summary = `SLA breaches by rule: ` + rows.map((r) => `${r.rule_label} ${formatIndian(r.breach_count)} projects (threshold ${r.threshold_label})`).join("; ") + `. ${formatIndian(breachingProjects)} distinct projects breach at least one rule.`;
  return (
    <Panel title="SLA breaches by rule" subtitle={`${formatIndian(breachingProjects)} projects breach at least one rule.`} info="A project may breach more than one rule, so these counts sum to more than the number of breaching projects. Thresholds are the policy values in force on the SLA monitoring page." summary={summary} className="span-4">
      <ul className="bar-list">
        {rows.map((r) => (
          <li key={r.rule_key}>
            <button type="button" onClick={() => router.push(`/sla?rule=${encodeURIComponent(r.rule_key)}`)} aria-label={`${r.rule_label}: ${formatIndian(r.breach_count)} projects in breach, threshold ${r.threshold_label}. Open on SLA monitoring`}>
              <span className="bar-label"><strong>{r.rule_label}</strong><small>Breach when {r.threshold_label}</small>{r.rule_key === "milestone_slippage" && <small>{formatIndian(milestonesDelayed)} of {formatIndian(milestonesTotal)} milestones delayed</small>}</span>
              <span className="bar-track"><i style={{ width: `${(r.breach_count / max) * 100}%` }} /></span>
              <span className="bar-count">{formatIndian(r.breach_count)}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
