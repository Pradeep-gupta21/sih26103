from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.intelligence import ProjectIntelligenceResponse
from app.schemas.project import ProjectRiskRequest


class SavedFieldMeta(BaseModel):
    """How one confirmed value came to be: what the extractor thought, and whether a person changed it."""

    confidence: Literal["high", "low"] | None = Field(default=None, description="Extractor confidence; None when it found nothing")
    edited: bool = Field(description="True when the user changed or supplied the value on the review step")
    source_snippet: str | None = None
    page: int | None = Field(default=None, ge=1)


class SavedDocument(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    page_count: int = Field(ge=0)


class SavedAnalysisCreate(BaseModel):
    """A document-derived analysis as the user confirmed it, plus the pipeline output it produced.

    The PDF itself and the raw extracted text are deliberately absent: only the values a
    person signed off on, and the report computed from them, are kept.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    document: SavedDocument
    confirmed_values: ProjectRiskRequest = Field(description="Exactly the input sent to the pipeline")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    field_metadata: dict[str, SavedFieldMeta] = Field(description="Keyed by ProjectRiskRequest field name")
    result: ProjectIntelligenceResponse


class SavedAnalysisSummary(BaseModel):
    id: str
    name: str
    document_filename: str
    saved_at: str = Field(description="ISO 8601, UTC")
    risk_percentage: int = Field(ge=0, le=100)
    risk_level: str
    edited_field_count: int = Field(ge=0)


class SavedAnalysis(SavedAnalysisCreate):
    id: str
    saved_at: str
