"""SLA rule monitoring: deterministic threshold checks on project record fields.

Every rule here is arithmetic on columns of data/projects.csv compared with a policy
threshold from app/config/sla_rules_config.py. Nothing is predicted, nothing is sampled,
and the prediction pipeline is neither called nor fed: a breach is a fact about the
record, and the model's risk score is unchanged by anything this module does.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from app.config import sla_rules_config as config
from app.schemas.project import ProjectRecord
from app.schemas.sla_rules import (
    ProjectSlaReport,
    SlaAlertPreview,
    SlaBreachListResponse,
    SlaBreachRow,
    SlaBreachSummary,
    SlaRuleDefinition,
    SlaRuleResult,
)
from app.services.notification_service import NotificationSettings
from app.services.project_service import ProjectService


@dataclass(frozen=True)
class _Rule:
    definition: SlaRuleDefinition
    measure: Callable[[ProjectRecord], tuple[float, str]]  # -> (measured value, detail)
    critical_excess: float  # excess over threshold at which a breach becomes CRITICAL


def _cost_escalation(project: ProjectRecord) -> tuple[float, str]:
    value = (project.revised_cost - project.original_cost) / project.original_cost * 100
    return round(value, 2), (
        f"revised_cost {project.revised_cost:g} vs original_cost {project.original_cost:g} = {value:.1f}% escalation"
    )


def _schedule_overrun(project: ProjectRecord) -> tuple[float, str]:
    value = project.project_age_months - project.planned_duration_months
    return float(value), (
        f"project_age_months {project.project_age_months} vs planned_duration_months {project.planned_duration_months} = "
        f"{value:+d} months"
    )


def _progress_shortfall(project: ProjectRecord) -> tuple[float, str]:
    expected = min(100.0, project.project_age_months / project.planned_duration_months * 100)
    value = expected - project.physical_progress
    return round(value, 2), (
        f"expected {expected:.1f}% physical progress at {project.project_age_months}/{project.planned_duration_months} months "
        f"elapsed vs reported {project.physical_progress:g}% = {value:.1f} point shortfall"
    )


def _reporting_divergence(project: ProjectRecord) -> tuple[float, str]:
    value = abs(project.physical_progress - project.financial_progress)
    return round(value, 2), (
        f"physical_progress {project.physical_progress:g}% vs financial_progress {project.financial_progress:g}% = "
        f"{value:.1f} point gap"
    )


def _milestone_slippage(project: ProjectRecord) -> tuple[float, str]:
    value = project.milestones_delayed / project.milestones_total * 100
    return round(value, 2), (
        f"milestones_delayed {project.milestones_delayed} of milestones_total {project.milestones_total} = {value:.1f}% slipped"
    )


RULES: tuple[_Rule, ...] = (
    _Rule(
        SlaRuleDefinition(
            id="schedule_overrun", name="Schedule overrun",
            description="project_age_months minus planned_duration_months",
            threshold=config.SCHEDULE_OVERRUN_MAX_MONTHS, unit="months",
        ),
        _schedule_overrun, config.CRITICAL_OVERRUN_MONTHS,
    ),
    _Rule(
        SlaRuleDefinition(
            id="cost_escalation", name="Cost escalation",
            description="(revised_cost - original_cost) / original_cost",
            threshold=config.COST_ESCALATION_MAX_PERCENT, unit="%",
        ),
        _cost_escalation, config.COST_ESCALATION_MAX_PERCENT * (config.CRITICAL_EXCESS_RATIO - 1),
    ),
    _Rule(
        SlaRuleDefinition(
            id="progress_shortfall", name="Progress shortfall",
            description="linear expected progress (project_age_months / planned_duration_months) minus physical_progress",
            threshold=config.PROGRESS_SHORTFALL_MAX_POINTS, unit="points",
        ),
        _progress_shortfall, config.PROGRESS_SHORTFALL_MAX_POINTS * (config.CRITICAL_EXCESS_RATIO - 1),
    ),
    _Rule(
        SlaRuleDefinition(
            id="reporting_divergence", name="Reporting divergence",
            description="absolute gap between physical_progress and financial_progress",
            threshold=config.REPORTING_DIVERGENCE_MAX_POINTS, unit="points",
        ),
        _reporting_divergence, config.REPORTING_DIVERGENCE_MAX_POINTS * (config.CRITICAL_EXCESS_RATIO - 1),
    ),
    _Rule(
        SlaRuleDefinition(
            id="milestone_slippage", name="Milestone slippage",
            description="milestones_delayed / milestones_total",
            threshold=config.MILESTONE_SLIPPAGE_MAX_PERCENT, unit="%",
        ),
        _milestone_slippage, config.MILESTONE_SLIPPAGE_MAX_PERCENT * (config.CRITICAL_EXCESS_RATIO - 1),
    ),
)
RULE_DEFINITIONS: list[SlaRuleDefinition] = [rule.definition for rule in RULES]
RULE_IDS = {rule.definition.id for rule in RULES}


class SlaRulesService:
    def __init__(self, project_service: ProjectService, settings: NotificationSettings | None = None) -> None:
        self.project_service = project_service
        self.settings = settings or NotificationSettings.from_env()

    # --- per project -----------------------------------------------------------------
    def evaluate(self, project: ProjectRecord) -> ProjectSlaReport:
        results = [self._evaluate_rule(rule, project) for rule in RULES]
        breached = [result for result in results if result.breached]
        worst = max(breached, key=_excess_ratio, default=None)
        return ProjectSlaReport(
            project_id=project.project_id,
            sector=project.sector,
            state=project.state,
            evaluated_rules=len(results),
            breached_rules=len(breached),
            overall_status="BREACH" if breached else "PASS",
            worst_severity=worst.severity if worst else None,
            results=results,
            alert_preview=self._alert_preview(project, worst) if worst else None,
        )

    def evaluate_by_id(self, project_id: str) -> ProjectSlaReport | None:
        project = self.project_service.get_project(project_id)
        return None if project is None else self.evaluate(project)

    # --- portfolio -------------------------------------------------------------------
    def breaches(self, rule_filter: str | None = None, limit: int = 100, offset: int = 0) -> SlaBreachListResponse:
        if rule_filter is not None and rule_filter not in RULE_IDS:
            raise ValueError(f"Unknown rule '{rule_filter}'")
        reports = [self.evaluate(project) for project in self.project_service.projects]
        by_rule = {rule.definition.id: 0 for rule in RULES}
        rows: list[SlaBreachRow] = []
        passing: list[str] = []
        for report in reports:
            breached = [result for result in report.results if result.breached]
            if not breached:
                passing.append(report.project_id)
                continue
            for result in breached:
                by_rule[result.rule_id] += 1
            if rule_filter and all(result.rule_id != rule_filter for result in breached):
                continue
            worst = max(breached, key=_excess_ratio)
            filtered = next((result for result in breached if result.rule_id == rule_filter), None) if rule_filter else None
            rows.append(
                SlaBreachRow(
                    project_id=report.project_id,
                    sector=report.sector,
                    state=report.state,
                    breached_rules=[result.rule_id for result in breached],
                    worst_severity=worst.severity or "WARNING",
                    worst_rule=worst,
                    filter_rule=filtered,
                )
            )
        # Severity first, then how far past its threshold (the filtered rule's when filtering), then how many rules.
        def sort_key(row: SlaBreachRow) -> tuple:
            primary = row.filter_rule or row.worst_rule
            return (primary.severity != "CRITICAL", -_excess_ratio(primary), -len(row.breached_rules), row.project_id)
        rows.sort(key=sort_key)
        in_breach = len(reports) - len(passing)
        return SlaBreachListResponse(
            summary=SlaBreachSummary(
                projects_evaluated=len(reports),
                projects_in_breach=in_breach,
                projects_passing=len(passing),
                breaches_by_rule=by_rule,
                delivery_enabled=self.settings.enabled,
            ),
            rules=RULE_DEFINITIONS,
            rule_filter=rule_filter,  # type: ignore[arg-type]
            total_matching=len(rows),
            rows=rows[offset : offset + limit],
            passing_project_ids=passing[:limit],
        )

    # --- helpers ---------------------------------------------------------------------
    @staticmethod
    def _evaluate_rule(rule: _Rule, project: ProjectRecord) -> SlaRuleResult:
        value, detail = rule.measure(project)
        definition = rule.definition
        breached = value > definition.threshold
        severity = None
        if breached:
            severity = "CRITICAL" if value - definition.threshold >= rule.critical_excess else "WARNING"
        return SlaRuleResult(
            rule_id=definition.id,
            name=definition.name,
            measured_value=value,
            threshold=definition.threshold,
            unit=definition.unit,
            breached=breached,
            severity=severity,
            detail=detail,
        )

    def _alert_preview(self, project: ProjectRecord, worst: SlaRuleResult) -> SlaAlertPreview:
        message = (
            f"PAIMANA SLA escalation -- {project.project_id} ({project.sector}, {project.state}): "
            f"{worst.name} breached. Measured {worst.measured_value:g} {worst.unit} against a threshold of "
            f"{worst.threshold:g} {worst.unit}. Severity {worst.severity}. {worst.detail}."
        )
        return SlaAlertPreview(
            delivery_enabled=self.settings.enabled,
            recipient_role=config.ALERT_RECIPIENT_ROLE,
            recipient_configured=bool(self.settings.recipient),
            rule_id=worst.rule_id,
            rule_name=worst.name,
            project_id=project.project_id,
            measured_value=worst.measured_value,
            threshold=worst.threshold,
            unit=worst.unit,
            message=message,
        )


def _excess_ratio(result: SlaRuleResult) -> float:
    """How far past its threshold a breach is, on the threshold's own scale (schedule overrun uses months)."""
    scale = result.threshold if result.threshold > 0 else config.CRITICAL_OVERRUN_MONTHS
    return (result.measured_value - result.threshold) / scale


def build_sla_rules_service(project_service: ProjectService) -> SlaRulesService:
    return SlaRulesService(project_service)
