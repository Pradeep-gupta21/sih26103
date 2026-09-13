import type { ProjectRecord } from "@/lib/prediction-api";

/**
 * A "risk signal" is a rule on the project's own recorded fields -- not a model risk level.
 * The registry endpoint returns inputs only; the model's risk level exists solely as the
 * output of a per-project prediction, which the list never runs. Kept in one place so
 * the filter, its explanation, and the empty state cannot disagree.
 *
 * TWIN: backend/app/services/risk_signal_service.py holds the identical rule for the
 * dashboard KPI. Change both or neither -- the two counts must match exactly.
 */
export const RISK_SIGNAL_RULE = "at least 30% of milestones delayed, a pending land, clearance, funding or contractor issue, or a schedule deviation above 8%";

export function hasRiskSignal(project: ProjectRecord): boolean {
  return project.milestones_delayed / project.milestones_total >= 0.3 || project.land_acquisition_pending || project.clearance_pending || project.funding_issue || project.contractor_issue || project.previous_schedule_deviation > 8;
}
