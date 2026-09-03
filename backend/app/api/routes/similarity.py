from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.similarity import SimilarityRequest, SimilarityResponse
from app.services.similarity_service import SimilarityService

router = APIRouter(tags=["similarity"])


@router.post("/similar-projects", response_model=SimilarityResponse, status_code=status.HTTP_200_OK)
def find_similar_projects(request: Request, payload: SimilarityRequest) -> SimilarityResponse:
    service: SimilarityService | None = getattr(request.app.state, "similarity_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Similarity model is unavailable")
    try:
        return service.find_similar(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Similarity service failed") from exc
