from __future__ import annotations

from pydantic import BaseModel

from app.schemas.project import ProjectRiskResponse
from app.schemas.similarity import SimilarityResponse


class ProjectIntelligenceResponse(BaseModel):
    """Combined risk prediction and historical similarity in one response."""

    prediction: ProjectRiskResponse
    similarity: SimilarityResponse
