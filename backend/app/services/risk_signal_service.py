"""The registry "risk signal" predicate, as a rule on a project's own recorded fields.

This is the Python twin of `hasRiskSignal` in src/lib/risk-signals.ts, which the
/projects?risk=high list applies client-side. The two MUST stay identical: the dashboard
KPI comes from this function and the list count from the TypeScript one, and the
acceptance criterion is that they agree exactly. Change both or neither.

Not a model output: the delay-risk pipeline is neither called nor fed here.
"""

from __future__ import annotations

from app.schemas.project import ProjectRecord

MILESTONE_DELAY_SHARE: float = 0.3
SCHEDULE_DEVIATION_PERCENT: float = 8.0

RISK_SIGNAL_RULE = (
    "at least 30% of milestones delayed, a pending land, clearance, funding or contractor issue, "
    "or a schedule deviation above 8%"
)


def has_risk_signal(project: ProjectRecord) -> bool:
    return (
        project.milestones_delayed / project.milestones_total >= MILESTONE_DELAY_SHARE
        or project.land_acquisition_pending
        or project.clearance_pending
        or project.funding_issue
        or project.contractor_issue
        or project.previous_schedule_deviation > SCHEDULE_DEVIATION_PERCENT
    )
