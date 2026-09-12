from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.analysis import SavedAnalysis, SavedAnalysisCreate, SavedAnalysisSummary
from app.services.analysis_service import AnalysisNotFoundError, AnalysisService, build_analysis_service

router = APIRouter(prefix="/analyses", tags=["Saved Analyses"])


def get_analysis_service(request: Request) -> AnalysisService:
    service: AnalysisService | None = getattr(request.app.state, "analysis_service", None)
    if service is None:
        error = getattr(request.app.state, "analysis_error", None)
        if error:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Saved-analysis store unavailable: {error}")
        service = build_analysis_service()
        request.app.state.analysis_service = service
    return service


@router.post(
    "",
    response_model=SavedAnalysis,
    status_code=status.HTTP_201_CREATED,
    summary="Save a document-derived analysis",
    description=(
        "Stores the values a user confirmed on the document analyzer together with the "
        "report the pipeline produced from them. Nothing is recomputed here, and the record "
        "stays outside the project registry."
    ),
)
def create_analysis(request: Request, payload: SavedAnalysisCreate) -> SavedAnalysis:
    return get_analysis_service(request).create(payload)


@router.get("", response_model=list[SavedAnalysisSummary], summary="List saved analyses, newest first")
def list_analyses(request: Request) -> list[SavedAnalysisSummary]:
    return get_analysis_service(request).list()


@router.get("/{analysis_id}", response_model=SavedAnalysis, summary="Full saved analysis")
def get_analysis(request: Request, analysis_id: str) -> SavedAnalysis:
    try:
        return get_analysis_service(request).get(analysis_id)
    except AnalysisNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis '{analysis_id}' not found") from exc


@router.delete("/{analysis_id}", status_code=status.HTTP_200_OK, summary="Delete a saved analysis")
def delete_analysis(request: Request, analysis_id: str) -> dict[str, str]:
    try:
        get_analysis_service(request).delete(analysis_id)
    except AnalysisNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Analysis '{analysis_id}' not found") from exc
    return {"status": "success", "message": f"Analysis '{analysis_id}' deleted"}
