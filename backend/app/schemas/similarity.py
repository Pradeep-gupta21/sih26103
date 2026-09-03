from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.project import ProjectRiskRequest


class SimilarityRequest(ProjectRiskRequest):
    """The same validated raw project shape used by the prediction feature."""


class HistoricalProjectMatch(BaseModel):
    project_id: str
    similarity_percentage: float = Field(ge=0, le=100)
    sector: str
    state: str
    original_cost: float
    actual_delay_months: int = Field(ge=0)
    actual_outcome: str
    primary_delay_cause: str


class SimilarityResponse(BaseModel):
    matches: list[HistoricalProjectMatch]
    evidence: "SimilarityEvidence"


class SimilarityEvidence(BaseModel):
    similar_projects_count: int = Field(ge=0)
    delayed_projects_count: int = Field(ge=0)
    delayed_over_six_months_count: int = Field(ge=0)
    delay_rate: float = Field(ge=0, le=1)
    summary: str
