from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.portfolio import PortfolioSummary
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["Portfolio overview"])


@router.get(
    "/summary",
    response_model=PortfolioSummary,
    summary="Every aggregate the dashboard overview needs, in one call",
    description=(
        "Portfolio-level counts, sums and distributions computed from the validated project "
        "registry, plus the SLA evaluation already served by /sla/breaches. Computed once per "
        "process and cached; no model is involved."
    ),
)
def portfolio_summary(request: Request) -> PortfolioSummary:
    service: PortfolioService | None = getattr(request.app.state, "portfolio_service", None)
    if service is None:
        detail = getattr(request.app.state, "project_error", None) or "Portfolio summary is unavailable"
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    return service.summary()
