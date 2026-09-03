from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.intelligence import ProjectIntelligenceResponse
from app.schemas.project import ProjectRiskRequest
from app.services.prediction_service import SavedPredictionService
from app.services.similarity_service import SimilarityService

router = APIRouter(tags=["intelligence"])


@router.post(
    "/project-intelligence",
    response_model=ProjectIntelligenceResponse,
    status_code=status.HTTP_200_OK,
)
def project_intelligence(request: Request, payload: ProjectRiskRequest) -> ProjectIntelligenceResponse:
    """Run risk prediction and historical similarity search in a single call."""
    prediction_service: SavedPredictionService | None = getattr(request.app.state, "prediction_service", None)
    similarity_service: SimilarityService | None = getattr(request.app.state, "similarity_service", None)
    if prediction_service is None and similarity_service is None:
        raise HTTPException(status_code=503, detail="Both prediction and similarity models are unavailable")
    prediction_result = None
    similarity_result = None
    errors: list[str] = []
    if prediction_service is not None:
        try:
            prediction_result = prediction_service.predict(payload)
        except (ValueError, RuntimeError) as exc:
            errors.append(f"Prediction failed: {exc}")
    else:
        errors.append("Prediction model is unavailable")
    if similarity_service is not None:
        try:
            similarity_result = similarity_service.find_similar(payload)
        except (ValueError, RuntimeError) as exc:
            errors.append(f"Similarity search failed: {exc}")
    else:
        errors.append("Similarity model is unavailable")
    if prediction_result is None or similarity_result is None:
        raise HTTPException(status_code=503, detail="; ".join(errors))
    return ProjectIntelligenceResponse(prediction=prediction_result, similarity=similarity_result)
