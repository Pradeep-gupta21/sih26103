from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.schemas.sla_rules import ProjectSlaReport, SlaBreachListResponse, SlaRuleDefinition
from app.services.sla_rules_service import RULE_DEFINITIONS, SlaRulesService

# A new prefix on purpose: the older milestone-deadline endpoints under /projects/{id}/sla
# keep their exact contract; these are the field-threshold rules.
router = APIRouter(prefix="/sla", tags=["SLA rule monitoring"])


def _service(request: Request) -> SlaRulesService:
    service: SlaRulesService | None = getattr(request.app.state, "sla_rules_service", None)
    if service is None:
        detail = getattr(request.app.state, "project_error", None) or "SLA rule monitoring is unavailable"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    return service


@router.get("/rules", response_model=list[SlaRuleDefinition], summary="The rules and policy thresholds in force")
def list_rules() -> list[SlaRuleDefinition]:
    return RULE_DEFINITIONS


@router.get(
    "/breaches",
    response_model=SlaBreachListResponse,
    summary="Every registry project evaluated against the SLA rules",
    description=(
        "Deterministic threshold checks on projects.csv fields. Returns portfolio counts, the "
        "breaching projects sorted by severity, and the ids of projects that pass every rule. "
        "No model is involved."
    ),
)
def list_breaches(
    request: Request,
    rule: str | None = Query(default=None, description="Only projects breaching this rule id"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> SlaBreachListResponse:
    try:
        return _service(request).breaches(rule_filter=rule, limit=limit, offset=offset)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/projects/{project_id}", response_model=ProjectSlaReport, summary="Every rule for one project")
def project_report(request: Request, project_id: str) -> ProjectSlaReport:
    report = _service(request).evaluate_by_id(project_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return report
