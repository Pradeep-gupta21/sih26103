from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.sla_rules import RuleId, SlaBreachRow


class PortfolioKpis(BaseModel):
    projects_tracked: int
    risk_signals_active: int = Field(description="Projects matching the registry risk-signal predicate")
    sla_in_breach: int = Field(description="Projects breaching at least one SLA rule")
    cost_overrun_total: float = Field(description="Sum of revised_cost - original_cost where revised exceeds original")
    cost_overrun_unit: str
    schedule_overrun_median_months: float = Field(description="Median of positive (project_age_months - planned_duration_months)")
    schedule_overrun_project_count: int = Field(description="How many projects the median is taken over")
    milestones_delayed_total: int
    milestones_total: int


class SectorCost(BaseModel):
    sector: str
    original_cost_sum: float
    revised_cost_sum: float
    project_count: int


class ProgressPoint(BaseModel):
    project_id: str
    sector: str
    physical_progress: float
    financial_progress: float


class ProgressDivergence(BaseModel):
    points: list[ProgressPoint]
    sampled: bool
    total_points: int
    below_line_total: int = Field(description="Projects where financial_progress > physical_progress, across the whole registry")


class SlaRuleBreakdown(BaseModel):
    rule_key: RuleId
    rule_label: str
    breach_count: int
    threshold_label: str


class OverrunBucket(BaseModel):
    bucket_key: str
    bucket_label: str
    project_count: int
    min_months: int | None = Field(description="Inclusive lower bound of the bucket in months; null for the on-time bucket")
    max_months: int | None = Field(description="Exclusive upper bound of the bucket in months; null when open-ended")


class StateDelays(BaseModel):
    state: str
    delayed_project_count: int
    total_project_count: int


class PortfolioSummary(BaseModel):
    kpis: PortfolioKpis
    cost_by_sector: list[SectorCost]
    progress_divergence: ProgressDivergence
    sla_rule_breakdown: list[SlaRuleBreakdown]
    schedule_overrun_histogram: list[OverrunBucket]
    top_states: list[StateDelays]
    critical_watchlist: list[SlaBreachRow] = Field(description="The first rows of /sla/breaches, in its exact order")
    generated_at: str


class RecentAnalysis(BaseModel):
    analysis_id: str
    project_name: str
    created_at: str
    risk_band_or_score: str
    risk_percentage: int
