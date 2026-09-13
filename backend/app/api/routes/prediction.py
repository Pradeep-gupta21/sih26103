from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.project import ProjectRiskRequest, ProjectRiskResponse
from app.services.prediction_service import SavedPredictionService

router = APIRouter(tags=["predictions"])


@router.post("/predict-risk", response_model=ProjectRiskResponse, status_code=status.HTTP_200_OK)
def predict_delay_risk(request: Request, payload: ProjectRiskRequest) -> ProjectRiskResponse:
    service: SavedPredictionService | None = request.app.state.prediction_service
    if service is None:
        raise HTTPException(status_code=503, detail="Prediction model is unavailable")
    try:
        return service.predict(payload)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Prediction service failed") from exc
