from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Confidence = Literal["high", "low"]
ValueType = Literal["text", "number", "integer", "boolean"]


class ExtractedField(BaseModel):
    """One prediction input as read from an uploaded document.

    `value` is None whenever the field could not be located -- it is never defaulted or
    guessed. `confidence` is None exactly when `value` is None.
    """

    field: str = Field(description="ProjectRiskRequest field name")
    label: str = Field(description="Plain-English label for the review screen")
    value_type: ValueType
    value: str | float | int | bool | None = None
    confidence: Confidence | None = None
    source_snippet: str | None = Field(default=None, description="The document line the value was read from")
    page: int | None = Field(default=None, ge=1, description="1-based page the snippet was found on")
    note: str | None = Field(default=None, description="Why the field is low-confidence or missing")


class DocumentExtractionResponse(BaseModel):
    filename: str
    page_count: int = Field(ge=0)
    text_characters: int = Field(ge=0)
    fields: list[ExtractedField] = Field(description="One entry per ProjectRiskRequest field, in model order")
    optional_fields: list[ExtractedField] = Field(
        default_factory=list,
        description="Coordinates for GIS screening (latitude/longitude); optional to the pipeline",
    )
    unmatched_text: list[str] = Field(
        default_factory=list,
        description="Numeric lines and table rows that were not mapped to any field",
    )
    warnings: list[str] = Field(default_factory=list)
