"use client";

import type { PortfolioKpis, SlaRuleBreakdown } from "@/lib/prediction-api";
import { Card } from "@/components/ui/card";
import { formatIndian } from "@/lib/format";

/**
 * The portfolio's worst measured fact, as one sentence, composed entirely from API values:
 * the recorded cost escalation total and the count of projects past the cost-escalation
 * SLA threshold. Two supporting figures on the right.
 */
export function HeadlineBand({ kpis, rules }: { kpis: PortfolioKpis; rules: SlaRuleBreakdown[] }) {
  const costRule = rules.find((r) => r.rule_key === "cost_escalation") ?? null;
  return (
    <Card accent className="headline-band" aria-label="Portfolio headline">
      <p className="headline-text">
        {formatIndian(kpis.cost_overrun_total)} {kpis.cost_overrun_unit} revised over original sanction
        <small>{costRule
          ? `${formatIndian(costRule.breach_count)} of ${formatIndian(kpis.projects_tracked)} projects exceed the ${costRule.threshold_label.replace(/^>\s*/, "")} cost-escalation threshold.`
          : `Across ${formatIndian(kpis.projects_tracked)} projects in the registry.`}</small>
      </p>
      <div className="headline-side">
        <div><span>Projects in SLA breach</span><strong className="is-critical">{formatIndian(kpis.sla_in_breach)}</strong></div>
        <div><span>Projects past planned duration</span><strong>{formatIndian(kpis.schedule_overrun_project_count)}</strong></div>
      </div>
    </Card>
  );
}
