from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RuleId = Literal["schedule_overrun", "cost_escalation", "progress_shortfall", "reporting_divergence", "milestone_slippage"]
RuleSeverity = Literal["CRITICAL", "WARNING"]


class SlaRuleDefinition(BaseModel):
    id: RuleId
    name: str
    description: str = Field(description="What is measured and from which projects.csv fields")
    threshold: float
    unit: str = Field(description="Unit of both the threshold and the measured value")
    comparison: Literal["greater_than"] = "greater_than"


class SlaRuleResult(BaseModel):
    rule_id: RuleId
    name: str
    measured_value: float
    threshold: float
    unit: str
    breached: bool
    severity: RuleSeverity | None = Field(default=None, description="Set only when breached")
    detail: str = Field(description="The measurement spelled out from the record's own fields")


class SlaAlertPreview(BaseModel):
    """What an escalation would say. Never dispatched: shown so a reviewer can see the content."""

    dispatched: Literal[False] = False
    delivery_enabled: bool = Field(description="MSG91_ENABLED as configured in this environment")
    recipient_role: str
    recipient_configured: bool
    rule_id: RuleId
    rule_name: str
    project_id: str
    measured_value: float
    threshold: float
    unit: str
    message: str


class ProjectSlaReport(BaseModel):
    project_id: str
    sector: str
    state: str
    evaluated_rules: int
    breached_rules: int
    overall_status: Literal["PASS", "BREACH"]
    worst_severity: RuleSeverity | None = None
    results: list[SlaRuleResult]
    alert_preview: SlaAlertPreview | None = Field(default=None, description="Present only when at least one rule is breached")


class SlaBreachRow(BaseModel):
    project_id: str
    sector: str
    state: str
    breached_rules: list[RuleId]
    worst_severity: RuleSeverity
    worst_rule: SlaRuleResult = Field(description="The breach furthest past its threshold, with value and threshold")
    filter_rule: SlaRuleResult | None = Field(default=None, description="When a rule filter is applied: that rule's measurement for this project")


class SlaBreachSummary(BaseModel):
    projects_evaluated: int
    projects_in_breach: int
    projects_passing: int
    breaches_by_rule: dict[str, int]
    delivery_enabled: bool


class SlaBreachListResponse(BaseModel):
    summary: SlaBreachSummary
    rules: list[SlaRuleDefinition]
    rule_filter: RuleId | None = None
    total_matching: int
    rows: list[SlaBreachRow]
    passing_project_ids: list[str] = Field(description="Ids of projects that pass every rule (first page)")
