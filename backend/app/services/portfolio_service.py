"""Portfolio-level aggregates for the /dashboard overview.

Everything here is arithmetic over the validated registry records already held by
ProjectService, plus the SLA evaluation already performed by SlaRulesService. Nothing is
predicted and nothing is re-read from disk: the registry is static for the life of the
process, so the summary is computed once, on first request, and cached on the service.

Predicates are imported, never restated:
  - risk signals -> app.services.risk_signal_service.has_risk_signal
  - SLA breaches -> SlaRulesService.breaches() (counts, per-rule counts, ordered rows)
so the dashboard cannot drift from /projects?risk=high or /sla.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import median

from app.schemas.portfolio import (
    OverrunBucket,
    PortfolioKpis,
    PortfolioSummary,
    ProgressDivergence,
    ProgressPoint,
    SectorCost,
    SlaRuleBreakdown,
    StateDelays,
)
from app.schemas.project import ProjectRecord
from app.services.project_service import ProjectService
from app.services.risk_signal_service import has_risk_signal
from app.services.sla_rules_service import RULES, SlaRulesService

COST_UNIT = "Rs crore"  # the unit projects.csv costs are recorded in (see documents/page.tsx field spec)
SCATTER_MAX_POINTS = 1200
WATCHLIST_SIZE = 10
TOP_STATES = 10

# Fixed display order. Bounds are in whole months: min inclusive, max exclusive.
OVERRUN_BUCKETS: tuple[tuple[str, str, int | None, int | None], ...] = (
    ("on_time", "On time or early", None, 1),
    ("0_6", "0-6 months", 1, 7),
    ("6_12", "6-12 months", 7, 13),
    ("12_24", "1-2 years", 13, 25),
    ("24_plus", "2+ years", 25, None),
)


def schedule_overrun_months(project: ProjectRecord) -> int:
    """Same measurement as the SLA 'schedule_overrun' rule: project_age_months - planned_duration_months."""
    return project.project_age_months - project.planned_duration_months


def overrun_bucket_key(months: int) -> str:
    for key, _label, lower, upper in OVERRUN_BUCKETS:
        if (lower is None or months >= lower) and (upper is None or months < upper):
            return key
    raise ValueError(f"No overrun bucket for {months} months")  # unreachable: buckets cover every integer


def _format_threshold(threshold: float, unit: str) -> str:
    value = f"{threshold:g}"
    return f"> {value}%" if unit == "%" else f"> {value} {unit}"


def _stratified_sample(projects: list[ProjectRecord], limit: int) -> tuple[list[ProjectRecord], bool]:
    """Deterministic stratified downsample by sector: each sector keeps its share of `limit`,
    chosen at evenly spaced positions within that sector's project_id order."""
    if len(projects) <= limit:
        return list(projects), False
    by_sector: dict[str, list[ProjectRecord]] = defaultdict(list)
    for project in sorted(projects, key=lambda p: p.project_id):
        by_sector[project.sector].append(project)
    total = len(projects)
    # Largest-remainder apportionment so the shares sum to exactly `limit`.
    exact = {sector: len(rows) * limit / total for sector, rows in by_sector.items()}
    quotas = {sector: int(share) for sector, share in exact.items()}
    for sector in sorted(exact, key=lambda s: (exact[s] - quotas[s], s), reverse=True)[: limit - sum(quotas.values())]:
        quotas[sector] += 1
    sample: list[ProjectRecord] = []
    for sector in sorted(by_sector):
        rows, quota = by_sector[sector], quotas[sector]
        if quota == 0:
            continue
        step = len(rows) / quota
        sample.extend(rows[int(i * step)] for i in range(quota))
    return sample, True


class PortfolioService:
    def __init__(self, project_service: ProjectService, sla_rules_service: SlaRulesService) -> None:
        self.project_service = project_service
        self.sla_rules_service = sla_rules_service
        self._summary: PortfolioSummary | None = None

    def summary(self) -> PortfolioSummary:
        if self._summary is None:
            self._summary = self._compute()
        return self._summary

    def _compute(self) -> PortfolioSummary:
        projects = self.project_service.projects
        sla = self.sla_rules_service.breaches(limit=WATCHLIST_SIZE)

        overruns = [schedule_overrun_months(p) for p in projects]
        positive_overruns = [m for m in overruns if m > 0]
        cost_overrun = sum(p.revised_cost - p.original_cost for p in projects if p.revised_cost > p.original_cost)

        kpis = PortfolioKpis(
            projects_tracked=len(projects),
            risk_signals_active=sum(1 for p in projects if has_risk_signal(p)),
            sla_in_breach=sla.summary.projects_in_breach,
            cost_overrun_total=round(float(cost_overrun), 2),
            cost_overrun_unit=COST_UNIT,
            schedule_overrun_median_months=float(median(positive_overruns)) if positive_overruns else 0.0,
            schedule_overrun_project_count=len(positive_overruns),
            milestones_delayed_total=sum(p.milestones_delayed for p in projects),
            milestones_total=sum(p.milestones_total for p in projects),
        )

        sector_original: dict[str, float] = defaultdict(float)
        sector_revised: dict[str, float] = defaultdict(float)
        sector_count: Counter[str] = Counter()
        for p in projects:
            sector_original[p.sector] += p.original_cost
            sector_revised[p.sector] += p.revised_cost
            sector_count[p.sector] += 1
        cost_by_sector = sorted(
            (
                SectorCost(
                    sector=sector,
                    original_cost_sum=round(sector_original[sector], 2),
                    revised_cost_sum=round(sector_revised[sector], 2),
                    project_count=sector_count[sector],
                )
                for sector in sector_count
            ),
            key=lambda row: (-row.revised_cost_sum, row.sector),
        )

        sample, sampled = _stratified_sample(projects, SCATTER_MAX_POINTS)
        progress_divergence = ProgressDivergence(
            points=[
                ProgressPoint(
                    project_id=p.project_id, sector=p.sector,
                    physical_progress=p.physical_progress, financial_progress=p.financial_progress,
                )
                for p in sample
            ],
            sampled=sampled,
            total_points=len(projects),
            below_line_total=sum(1 for p in projects if p.financial_progress > p.physical_progress),
        )

        sla_rule_breakdown = sorted(
            (
                SlaRuleBreakdown(
                    rule_key=rule.definition.id,
                    rule_label=rule.definition.name,
                    breach_count=sla.summary.breaches_by_rule.get(rule.definition.id, 0),
                    threshold_label=_format_threshold(rule.definition.threshold, rule.definition.unit),
                )
                for rule in RULES
            ),
            key=lambda row: (-row.breach_count, row.rule_label),
        )

        bucket_counts = Counter(overrun_bucket_key(m) for m in overruns)
        histogram = [
            OverrunBucket(bucket_key=key, bucket_label=label, project_count=bucket_counts.get(key, 0), min_months=lower, max_months=upper)
            for key, label, lower, upper in OVERRUN_BUCKETS
        ]

        state_total: Counter[str] = Counter(p.state for p in projects)
        state_delayed: Counter[str] = Counter(p.state for p, m in zip(projects, overruns) if m > 0)
        top_states = sorted(
            (StateDelays(state=s, delayed_project_count=state_delayed.get(s, 0), total_project_count=state_total[s]) for s in state_total),
            key=lambda row: (-row.delayed_project_count, row.state),
        )[:TOP_STATES]

        return PortfolioSummary(
            kpis=kpis,
            cost_by_sector=cost_by_sector,
            progress_divergence=progress_divergence,
            sla_rule_breakdown=sla_rule_breakdown,
            schedule_overrun_histogram=histogram,
            top_states=top_states,
            critical_watchlist=sla.rows,
            generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        )


def build_portfolio_service(project_service: ProjectService, sla_rules_service: SlaRulesService) -> PortfolioService:
    return PortfolioService(project_service, sla_rules_service)
