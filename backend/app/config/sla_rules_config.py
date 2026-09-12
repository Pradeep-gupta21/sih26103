"""Policy thresholds for SLA rule monitoring (deterministic checks on project fields).

These are CONFIGURABLE POLICY VALUES, not model outputs. Every rule compares a value
computed from fields that exist in data/projects.csv against one of these thresholds.
A breach is a measured fact about the record; it is never predicted, and nothing here
feeds the XGBoost pipeline. The milestone-deadline SLA in data/sla_config.json is a
separate, older mechanism and is left untouched.
"""

from __future__ import annotations

# Cost escalation: (revised_cost - original_cost) / original_cost, as a percentage.
COST_ESCALATION_MAX_PERCENT: float = 10.0

# Progress shortfall: physical_progress compared with the linear expectation
# (project_age_months / planned_duration_months * 100, capped at 100). The rule breaches
# when the shortfall in percentage points exceeds this value.
PROGRESS_SHORTFALL_MAX_POINTS: float = 20.0

# Reporting divergence: |physical_progress - financial_progress| in percentage points.
REPORTING_DIVERGENCE_MAX_POINTS: float = 15.0

# Milestone slippage: milestones_delayed / milestones_total, as a percentage.
MILESTONE_SLIPPAGE_MAX_PERCENT: float = 25.0

# Schedule overrun: project_age_months - planned_duration_months, in months. Any
# positive value is an overrun, so the threshold is 0.
SCHEDULE_OVERRUN_MAX_MONTHS: float = 0.0

# Severity: how far past its threshold a breach is, as a fraction of the threshold's
# scale. A breach at or beyond CRITICAL_EXCESS_RATIO x threshold (or, for the zero
# threshold of schedule overrun, beyond CRITICAL_OVERRUN_MONTHS) is CRITICAL; otherwise
# it is a WARNING. Used only for ordering and labelling, never for scoring.
CRITICAL_EXCESS_RATIO: float = 2.0
CRITICAL_OVERRUN_MONTHS: float = 6.0

# Who an escalation would go to. A role, not a person or number: the real recipient is
# the MSG91 configuration, which stays disabled in this environment.
ALERT_RECIPIENT_ROLE: str = "Ministry monitoring cell (MINISTRY_ALERT_PHONE)"
