from __future__ import annotations

from pathlib import Path

from app.models.similarity_model import HistoricalSimilarityModel
from app.schemas.similarity import SimilarityEvidence, SimilarityRequest, SimilarityResponse

MODEL_PATH = Path(__file__).resolve().parents[2] / "trained_models" / "similarity_pipeline" / "historical_similarity.joblib"


class SimilarityService:
    def __init__(self, model: HistoricalSimilarityModel) -> None:
        self.model = model

    def find_similar(self, payload: SimilarityRequest) -> SimilarityResponse:
        features = payload.model_dump(exclude={"project_id"})
        matches, evidence = self.model.find_matches(features, limit=3)
        return SimilarityResponse(matches=matches, evidence=SimilarityEvidence(**evidence))


def build_similarity_service() -> SimilarityService:
    return SimilarityService(HistoricalSimilarityModel(MODEL_PATH))
