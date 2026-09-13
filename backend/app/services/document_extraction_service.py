"""Read ProjectRiskRequest inputs out of an uploaded project PDF.

Label-based matching over the text lines and table rows pdfplumber produces. Nothing here
guesses: a field the document does not state comes back as None, and a value whose unit
or meaning is unclear is returned with `confidence="low"` and a note saying why. The
review screen is where a person confirms or corrects every value before it reaches the
model, so this service optimises for being honest about uncertainty, not for coverage.

The field list is taken from ProjectRiskRequest itself, so the extractor cannot drift
from what the prediction pipeline accepts.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

import pdfplumber

from app.schemas.document_extraction import DocumentExtractionResponse, ExtractedField
from app.schemas.project import ProjectRiskRequest

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

# Costs in projects.csv sit in the 25-50,000 range and the UI reports cost impact in
# "Rs ... Cr", so the model unit is taken to be crore. Every other currency scale seen in
# a document is converted to it.
COST_UNIT = "crore"
_SCALE_TO_CRORE = {
    "crore": 1.0,
    "crores": 1.0,
    "cr": 1.0,
    "cr.": 1.0,
    "lakh": 0.01,
    "lakhs": 0.01,
    "lac": 0.01,
    "lacs": 0.01,
    "million": 0.1,
    "mn": 0.1,
    "billion": 100.0,
    "bn": 100.0,
}

MAX_SNIPPET_CHARS = 220
MAX_UNMATCHED = 40

# Indian grouping (5,40,000.50) as well as western grouping and plain decimals.
_NUMBER = r"[-+]?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?"
_NUMBER_RE = re.compile(_NUMBER)
_SEPARATOR_RE = re.compile(r"^[\s:|=\-–—.]+")

_TRUE_PHRASES = (
    "not yet obtained", "not yet received", "not yet resolved", "not obtained", "not received",
    "not resolved", "not secured", "not available", "not complete", "not completed", "not yet",
    "yet to be", "awaited", "pending", "outstanding", "in progress", "ongoing", "incomplete",
    "partially", "partial", "delayed", "unresolved", "under process", "under review", "reported",
    "yes", "present", "exists", "stalled", "held up", "issue reported", "issues reported",
    "shortfall", "constraint", "dispute", "terminated", "default",
)
_FALSE_PHRASES = (
    "not pending", "not applicable", "no issue", "no issues", "none reported", "nil", "none",
    "n/a", "na", "no", "completed", "complete", "cleared", "obtained", "received", "resolved",
    "secured", "in place", "available", "fully acquired", "acquired", "granted", "approved",
    "released", "on track", "satisfactory", "100%", "100 %",
)

_BOOL_PATTERNS: tuple[tuple[re.Pattern[str], str, bool], ...] = tuple(
    (re.compile(r"(?<![a-z0-9%])" + re.escape(phrase) + r"(?![a-z])"), phrase, polarity)
    for phrase, polarity in [(p, True) for p in _TRUE_PHRASES] + [(p, False) for p in _FALSE_PHRASES]
)


@dataclass(frozen=True)
class Candidate:
    """A line of text (or a flattened table row) with where it came from."""

    text: str
    page: int
    origin: str  # "line" | "table"
    pair_value: str | None = None  # For table rows: the cell immediately after the label cell


@dataclass
class Match:
    value: Any
    confidence: str
    candidate: Candidate
    note: str | None = None


@dataclass(frozen=True)
class FieldSpec:
    label: str
    value_type: str
    synonyms: tuple[str, ...]
    exclude: tuple[str, ...] = ()
    kind: str = "number"  # currency | months | percent | count | deviation | boolean | sector | state


FIELD_SPECS: dict[str, FieldSpec] = {
    "sector": FieldSpec(
        "Sector", "text", ("sector", "infrastructure sector", "project sector", "project type", "project category"),
        kind="sector",
    ),
    "state": FieldSpec(
        "State", "text", ("state / ut", "state/ut", "state", "implementing state", "location \\(state\\)"),
        exclude=("statement", "status"),
        kind="state",
    ),
    "original_cost": FieldSpec(
        "Original cost", "number",
        (
            "original cost", "original sanctioned cost", "sanctioned cost", "approved cost", "approved outlay",
            "sanctioned outlay", "original outlay", "original estimate", "original project cost",
            "cost at sanction", "sanctioned amount", "approved project cost", "original estimated cost",
        ),
        exclude=("revised", "anticipated", "updated", "latest", "current"),
        kind="currency",
    ),
    "revised_cost": FieldSpec(
        "Revised cost", "number",
        (
            "revised cost", "revised sanctioned cost", "anticipated cost", "revised outlay", "revised estimate",
            "revised estimated cost", "latest cost", "updated cost", "current cost", "revised project cost",
            "anticipated completion cost", "revised approved cost",
        ),
        kind="currency",
    ),
    "planned_duration_months": FieldSpec(
        "Planned duration", "integer",
        (
            "planned duration", "original duration", "sanctioned duration", "scheduled duration", "project duration",
            "duration \\(planned\\)", "completion period", "construction period", "implementation period",
            "contract period", "planned completion period",
        ),
        exclude=("elapsed", "revised duration", "extended"),
        kind="months",
    ),
    "project_age_months": FieldSpec(
        "Project age", "integer",
        (
            "project age", "age of project", "months elapsed", "time elapsed", "elapsed duration", "elapsed time",
            "period elapsed", "months since sanction", "months since commencement", "time since start",
        ),
        kind="months",
    ),
    "physical_progress": FieldSpec(
        "Physical progress", "number",
        ("physical progress", "physical completion", "work progress", "physical achievement", "progress \\(physical\\)"),
        kind="percent",
    ),
    "financial_progress": FieldSpec(
        "Financial progress", "number",
        (
            "financial progress", "expenditure progress", "financial achievement", "financial completion",
            "expenditure incurred \\(%\\)", "cumulative expenditure \\(%\\)", "progress \\(financial\\)",
            "utilisation", "utilization",
        ),
        kind="percent",
    ),
    "milestones_total": FieldSpec(
        "Total milestones", "integer",
        (
            "total milestones", "milestones \\(total\\)", "number of milestones", "no\\. of milestones",
            "milestones planned", "planned milestones", "total number of milestones", "milestones total",
        ),
        kind="count",
    ),
    "milestones_delayed": FieldSpec(
        "Delayed milestones", "integer",
        (
            "delayed milestones", "milestones delayed", "milestones behind schedule", "slipped milestones",
            "milestones overdue", "overdue milestones", "milestones \\(delayed\\)", "number of delayed milestones",
            "no\\. of delayed milestones",
        ),
        kind="count",
    ),
    "land_acquisition_pending": FieldSpec(
        "Land acquisition pending", "boolean",
        ("land acquisition status", "land acquisition pending", "land acquisition", "land availability", "land handover"),
        kind="boolean",
    ),
    "clearance_pending": FieldSpec(
        "Clearance pending", "boolean",
        (
            "clearance status", "clearances pending", "clearance pending", "statutory clearances", "statutory clearance",
            "environmental clearance", "forest clearance", "clearances", "clearance",
        ),
        kind="boolean",
    ),
    "funding_issue": FieldSpec(
        "Funding issue", "boolean",
        ("funding issue", "funding issues", "funding status", "fund availability", "funding constraint", "funding", "fund release"),
        kind="boolean",
    ),
    "contractor_issue": FieldSpec(
        "Contractor issue", "boolean",
        ("contractor issue", "contractor issues", "contractor status", "contractor performance", "contractual issues", "contractor"),
        kind="boolean",
    ),
    "previous_schedule_deviation": FieldSpec(
        "Previous schedule deviation", "number",
        (
            "previous schedule deviation", "schedule deviation", "schedule slippage", "schedule variance",
            "time overrun", "schedule overrun", "delay to date", "schedule delay",
        ),
        kind="deviation",
    ),
}

OPTIONAL_SPECS: dict[str, FieldSpec] = {
    "latitude": FieldSpec("Latitude", "number", ("latitude", "lat\\."), kind="latitude"),
    "longitude": FieldSpec("Longitude", "number", ("longitude", "long\\.", "lon\\."), kind="longitude"),
}

# The field list comes from the request schema, never from this module's own table, so a
# field added to the model without an extraction rule fails loudly at import time.
FIELD_ORDER = [name for name in ProjectRiskRequest.model_fields if name != "project_id"]
_missing_specs = [name for name in FIELD_ORDER if name not in FIELD_SPECS]
if _missing_specs:
    raise RuntimeError(f"No extraction rule for ProjectRiskRequest fields: {_missing_specs}")


@lru_cache(maxsize=1)
def _vocabulary() -> tuple[tuple[str, ...], tuple[str, ...]]:
    """Sector and state names as they appear in the training data."""
    sectors: set[str] = set()
    states: set[str] = set()
    projects_csv = DATA_DIR / "projects.csv"
    if projects_csv.exists():
        with open(projects_csv, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row.get("sector"):
                    sectors.add(row["sector"].strip())
                if row.get("state"):
                    states.add(row["state"].strip())
    return tuple(sorted(sectors)), tuple(sorted(states))


# Everyday wording that maps onto a training-data sector. Only used when a line does not
# already contain the sector name itself.
_SECTOR_HINTS: tuple[tuple[str, str], ...] = (
    ("industrial corridor", "Industrial Corridors"),
    ("metro", "Urban Transit"),
    ("urban transit", "Urban Transit"),
    ("mass rapid transit", "Urban Transit"),
    ("railway", "Railways"),
    ("rail", "Railways"),
    ("highway", "Roads"),
    ("expressway", "Roads"),
    ("road", "Roads"),
    ("airport", "Airports"),
    ("aviation", "Airports"),
    ("port", "Ports"),
    ("harbour", "Ports"),
    ("transmission", "Power"),
    ("power", "Power"),
    ("energy", "Power"),
    ("water supply", "Water & Sanitation"),
    ("sanitation", "Water & Sanitation"),
    ("sewerage", "Water & Sanitation"),
    ("water", "Water & Sanitation"),
)

# Full list of Indian states and union territories: legitimate reference data so a state
# outside the training set is still recognised (and then flagged low, since the model has
# never seen it).
_INDIAN_STATES: tuple[str, ...] = (
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
)


class DocumentExtractionError(ValueError):
    """The upload is not a readable PDF."""


class DocumentExtractionService:
    def __init__(self, max_size_bytes: int) -> None:
        self.max_size_bytes = max_size_bytes
        self._label_res: dict[str, re.Pattern[str]] = {
            name: re.compile(r"(?i)(?<![a-z])(?:" + "|".join(spec.synonyms) + r")(?![a-z])")
            for name, spec in {**FIELD_SPECS, **OPTIONAL_SPECS}.items()
        }

    # ------------------------------------------------------------------ public
    def extract(self, filename: str, content: bytes) -> DocumentExtractionResponse:
        if len(content) > self.max_size_bytes:
            raise DocumentExtractionError(
                f"File size exceeds maximum allowed limit of {self.max_size_bytes // (1024 * 1024) or 1} MB"
            )
        if not content.lstrip().startswith(b"%PDF"):
            raise DocumentExtractionError("The uploaded file is not a PDF")

        candidates, page_count, text_chars, warnings = self._read_pdf(content)
        full_text = "\n".join(candidate.text for candidate in candidates)
        doc_unit = self._document_cost_unit(full_text)
        if doc_unit:
            warnings.append(f"Document states monetary figures in {doc_unit}; bare cost figures were read in that unit.")

        consumed: set[int] = set()
        fields: list[ExtractedField] = []
        for name in FIELD_ORDER:
            spec = FIELD_SPECS[name]
            matches = self._find_matches(name, spec, candidates, doc_unit)
            fields.append(self._resolve(name, spec, matches, consumed, candidates))

        fields = self._cross_check(fields)

        optional_fields = [
            self._resolve(name, spec, self._find_matches(name, spec, candidates, doc_unit), consumed, candidates)
            for name, spec in OPTIONAL_SPECS.items()
        ]
        optional_fields = self._coordinate_pair_fallback(optional_fields, candidates, consumed)

        if text_chars == 0:
            warnings.append(
                "No text layer was found in this PDF (it may be a scanned image). OCR is not available, so no fields could be read."
            )

        unmatched = self._unmatched(candidates, consumed)
        return DocumentExtractionResponse(
            filename=filename,
            page_count=page_count,
            text_characters=text_chars,
            fields=fields,
            optional_fields=optional_fields,
            unmatched_text=unmatched,
            warnings=warnings,
        )

    # ------------------------------------------------------------- pdf reading
    @staticmethod
    def _read_pdf(content: bytes) -> tuple[list[Candidate], int, int, list[str]]:
        candidates: list[Candidate] = []
        warnings: list[str] = []
        text_chars = 0
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                page_count = len(pdf.pages)
                for index, page in enumerate(pdf.pages, start=1):
                    try:
                        text = page.extract_text() or ""
                    except Exception:  # pdfplumber raises assorted pdfminer errors on damaged pages
                        warnings.append(f"Page {index} could not be read as text.")
                        text = ""
                    text_chars += len(text.strip())
                    for raw_line in text.splitlines():
                        line = _clean(raw_line)
                        if line:
                            candidates.append(Candidate(line, index, "line"))
                    try:
                        tables = page.extract_tables() or []
                    except Exception:
                        warnings.append(f"Tables on page {index} could not be read.")
                        tables = []
                    for table in tables:
                        for row in table:
                            cells = [_clean(cell) for cell in row if cell and _clean(cell)]
                            if len(cells) < 2:
                                continue
                            candidates.append(Candidate(" | ".join(cells), index, "table", pair_value=cells[1]))
        except DocumentExtractionError:
            raise
        except Exception as exc:  # encrypted, truncated, or not really a PDF
            raise DocumentExtractionError(f"Unable to read the PDF: {exc.__class__.__name__}") from exc
        return candidates, page_count, text_chars, warnings

    # ---------------------------------------------------------------- matching
    def _find_matches(
        self, name: str, spec: FieldSpec, candidates: list[Candidate], doc_unit: str | None
    ) -> list[Match]:
        label_re = self._label_res[name]
        exclude_re = re.compile(r"(?i)(?<![a-z])(?:" + "|".join(spec.exclude) + r")(?![a-z])") if spec.exclude else None
        parser = self._parser_for(spec.kind)
        matches: list[Match] = []
        for candidate in candidates:
            if exclude_re and exclude_re.search(candidate.text):
                continue
            # Every occurrence on the line counts, so "Revised outlay: 1,410; Revised outlay: 1,520"
            # surfaces as a conflict instead of silently keeping the first figure.
            hits = list(label_re.finditer(candidate.text))
            for position, hit in enumerate(hits):
                stop = hits[position + 1].start() if position + 1 < len(hits) else len(candidate.text)
                remainder = _SEPARATOR_RE.sub("", candidate.text[hit.end():stop]).strip()
                result = parser(remainder, candidate, doc_unit)
                if (
                    result is None
                    and candidate.pair_value
                    and candidate.pair_value.lower() not in candidate.text[: hit.end()].lower()
                ):
                    result = parser(candidate.pair_value, candidate, doc_unit)
                if result is None:
                    continue
                value, confidence, note = result
                matches.append(Match(value, confidence, candidate, note))
        if not matches and spec.kind == "sector":
            matches = self._sector_fallback(candidates)
        return matches

    def _sector_fallback(self, candidates: list[Candidate]) -> list[Match]:
        """No 'Sector:' label anywhere: look for a sector name or everyday wording in the text."""
        sectors, _ = _vocabulary()
        for candidate in candidates:
            lowered = candidate.text.lower()
            for sector in sectors:
                if re.search(r"(?<![a-z])" + re.escape(sector.lower()) + r"(?![a-z])", lowered):
                    return [Match(sector, "low", candidate, "No sector label found; inferred from the text")]
        for candidate in candidates:
            lowered = candidate.text.lower()
            for hint, sector in _SECTOR_HINTS:
                if re.search(r"(?<![a-z])" + re.escape(hint) + r"(?![a-z])", lowered):
                    return [Match(sector, "low", candidate, f"No sector label found; inferred from '{hint}' in the text")]
        return []

    def _parser_for(self, kind: str) -> Callable[[str, Candidate, str | None], tuple[Any, str, str | None] | None]:
        return {
            "currency": self._parse_currency,
            "months": self._parse_months,
            "percent": self._parse_percent,
            "count": self._parse_count,
            "deviation": self._parse_deviation,
            "boolean": self._parse_boolean,
            "sector": self._parse_sector,
            "state": self._parse_state,
            "latitude": lambda text, cand, unit: self._parse_coordinate(text, -90, 90),
            "longitude": lambda text, cand, unit: self._parse_coordinate(text, -180, 180),
        }[kind]

    @staticmethod
    def _resolve(
        name: str,
        spec: FieldSpec,
        matches: list[Match],
        consumed: set[int],
        candidates: list[Candidate],
    ) -> ExtractedField:
        if not matches:
            return ExtractedField(field=name, label=spec.label, value_type=spec.value_type, note="Not found in document")
        distinct = {repr(match.value) for match in matches}
        chosen = matches[0]
        confidence = chosen.confidence
        note = chosen.note
        if len(distinct) > 1:
            confidence = "low"
            listed = ", ".join(str(match.value) for match in matches[:4])
            note = f"Conflicting values found ({listed}); the first occurrence is shown"
        for match in matches:
            consumed.add(candidates.index(match.candidate))
        return ExtractedField(
            field=name,
            label=spec.label,
            value_type=spec.value_type,
            value=chosen.value,
            confidence=confidence,
            source_snippet=chosen.candidate.text[:MAX_SNIPPET_CHARS],
            page=chosen.candidate.page,
            note=note,
        )

    @staticmethod
    def _cross_check(fields: list[ExtractedField]) -> list[ExtractedField]:
        """Flag combinations the request schema would reject, without altering the values."""
        by_name = {item.field: item for item in fields}
        total, delayed = by_name["milestones_total"], by_name["milestones_delayed"]
        if (
            isinstance(total.value, int)
            and isinstance(delayed.value, int)
            and delayed.value > total.value
        ):
            delayed.confidence = "low"
            delayed.note = "Delayed milestones exceed total milestones; check both values"
        return fields

    # ----------------------------------------------------------------- parsers
    @staticmethod
    def _first_number(text: str) -> tuple[float, int, int] | None:
        found = _NUMBER_RE.search(text)
        if not found:
            return None
        try:
            return float(found.group().replace(",", "")), found.start(), found.end()
        except ValueError:
            return None

    def _parse_currency(self, text: str, candidate: Candidate, doc_unit: str | None):
        number = self._first_number(text)
        if number is None:
            return None
        value, start, end = number
        window = text[max(0, start - 24):end + 24].lower()
        for token, factor in sorted(_SCALE_TO_CRORE.items(), key=lambda item: -len(item[0])):
            if re.search(r"(?<![a-z])" + re.escape(token) + r"(?![a-z])", window):
                return round(value * factor, 4), "high", (None if factor == 1.0 else f"Converted from {token} to {COST_UNIT}")
        if doc_unit:
            factor = _SCALE_TO_CRORE[doc_unit]
            return round(value * factor, 4), "high", (None if factor == 1.0 else f"Document unit {doc_unit}, converted to {COST_UNIT}")
        return value, "low", f"No unit stated; figure shown as-is and assumed to be in {COST_UNIT}"

    def _parse_months(self, text: str, candidate: Candidate, doc_unit: str | None):
        number = self._first_number(text)
        if number is None:
            return None
        value, start, end = number
        after = text[end:end + 16].lower()
        if re.match(r"\s*(?:months?|mos?\b|m\b)", after):
            return int(round(value)), "high", None
        if re.match(r"\s*(?:years?|yrs?\b|y\b)", after):
            return int(round(value * 12)), "high", "Converted from years to months"
        if re.match(r"\s*(?:weeks?|wks?\b)", after):
            return int(round(value / 4.345)), "low", "Converted from weeks; verify"
        if re.match(r"\s*(?:days?)", after):
            return int(round(value / 30.437)), "low", "Converted from days; verify"
        return int(round(value)), "low", "No time unit stated; assumed months"

    def _parse_percent(self, text: str, candidate: Candidate, doc_unit: str | None):
        number = self._first_number(text)
        if number is None:
            return None
        value, start, end = number
        after = text[end:end + 12].lower()
        if re.match(r"\s*(?:%|percent|per cent|pc\b)", after):
            return value, "high", None
        if 0 <= value <= 1:
            return round(value * 100, 2), "low", "Read as a fraction and converted to a percentage; verify"
        if 0 <= value <= 100:
            return value, "low", "No % sign; assumed to be a percentage"
        return None

    def _parse_count(self, text: str, candidate: Candidate, doc_unit: str | None):
        number = self._first_number(text)
        if number is None:
            return None
        value, start, end = number
        if value != int(value):
            return None
        return int(value), "high", None

    def _parse_deviation(self, text: str, candidate: Candidate, doc_unit: str | None):
        number = self._first_number(text)
        if number is None:
            return None
        value, start, end = number
        before = text[max(0, start - 8):start].lower()
        if "-" in before or "minus" in before or "ahead" in text.lower():
            value = -abs(value)
        after = text[end:end + 12].lower()
        if re.match(r"\s*(?:%|percent|per cent)", after):
            return value, "high", None
        if re.match(r"\s*(?:months?|mos?\b)", after):
            return value, "low", "Stated in months; the model expects a percentage deviation -- verify"
        return value, "low", "No unit stated; verify this is a percentage deviation"

    @staticmethod
    def _parse_boolean(text: str, candidate: Candidate, doc_unit: str | None):
        lowered = text.lower()
        percent = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
        if percent and not re.search(r"(?<![a-z])(?:yes|no|nil|none|n/a)(?![a-z])", lowered):
            # "Land acquisition: 65% complete" -- anything short of complete counts as pending.
            return float(percent.group(1)) < 100, "low", "Inferred from a completion percentage; verify"
        best: tuple[int, int, bool] | None = None  # (position, -phrase length, polarity)
        for pattern, phrase, polarity in _BOOL_PATTERNS:
            found = pattern.search(lowered)
            if not found:
                continue
            key = (found.start(), -len(phrase), polarity)
            if best is None or key < best:
                best = key
        if best is not None:
            return best[2], "high", None
        return None

    def _parse_sector(self, text: str, candidate: Candidate, doc_unit: str | None):
        sectors, _ = _vocabulary()
        lowered = text.lower()
        if not lowered:
            return None
        for sector in sectors:
            if sector.lower() in lowered:
                return sector, "high", None
        for hint, sector in _SECTOR_HINTS:
            if re.search(r"(?<![a-z])" + re.escape(hint) + r"(?![a-z])", lowered):
                return sector, "low", f"Mapped from '{hint}' to the training-data sector '{sector}'"
        return None

    def _parse_state(self, text: str, candidate: Candidate, doc_unit: str | None):
        _, known_states = _vocabulary()
        lowered = text.lower()
        if not lowered:
            return None
        for state in sorted(_INDIAN_STATES, key=len, reverse=True):
            if state.lower() in lowered:
                if state in known_states:
                    return state, "high", None
                return state, "low", "State is not one the model was trained on"
        raw = re.split(r"[|;,]", text)[0].strip()
        if not raw or len(raw) > 60 or _NUMBER_RE.search(raw):
            return None
        return raw, "low", "Not recognised as an Indian state / UT"

    @staticmethod
    def _parse_coordinate(text: str, low: float, high: float):
        found = re.search(r"[-+]?\d{1,3}\.\d+", text)
        if not found:
            return None
        value = float(found.group())
        suffix = text[found.end():found.end() + 4].upper()
        if "S" in suffix or "W" in suffix:
            value = -abs(value)
        if not (low <= value <= high):
            return None
        return value, "high", None

    def _coordinate_pair_fallback(
        self, optional_fields: list[ExtractedField], candidates: list[Candidate], consumed: set[int]
    ) -> list[ExtractedField]:
        """Recognise '26.8467° N, 80.9462° E' when there are no explicit lat/long labels."""
        by_name = {item.field: item for item in optional_fields}
        if by_name["latitude"].value is not None and by_name["longitude"].value is not None:
            return optional_fields
        pair_re = re.compile(r"(\d{1,2}\.\d+)\s*°?\s*([NS])\b[\s,;]+(\d{1,3}\.\d+)\s*°?\s*([EW])\b", re.IGNORECASE)
        for index, candidate in enumerate(candidates):
            found = pair_re.search(candidate.text)
            if not found:
                continue
            lat = float(found.group(1)) * (-1 if found.group(2).upper() == "S" else 1)
            lon = float(found.group(3)) * (-1 if found.group(4).upper() == "W" else 1)
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            consumed.add(index)
            for name, value in (("latitude", lat), ("longitude", lon)):
                spec = OPTIONAL_SPECS[name]
                by_name[name] = ExtractedField(
                    field=name, label=spec.label, value_type="number", value=value, confidence="high",
                    source_snippet=candidate.text[:MAX_SNIPPET_CHARS], page=candidate.page,
                )
            break
        return [by_name["latitude"], by_name["longitude"]]

    # ----------------------------------------------------------------- helpers
    @staticmethod
    def _document_cost_unit(full_text: str) -> str | None:
        """A single document-wide statement such as '(Rs. in crore)' or 'figures in lakh'."""
        pattern = re.compile(
            r"(?i)(?:rs\.?|₹|inr|rupees|figures|amounts?|all figures)\s*(?:are\s+)?(?:in\s+)?\(?\s*(crore|crores|cr|lakh|lakhs|lac|lacs|million|mn)\b"
        )
        units = {match.group(1).lower() for match in pattern.finditer(full_text)}
        scales = {_SCALE_TO_CRORE[unit] for unit in units}
        if len(scales) != 1:
            return None
        return next(iter(units))

    @staticmethod
    def _unmatched(candidates: list[Candidate], consumed: set[int]) -> list[str]:
        seen: set[str] = set()
        unmatched: list[str] = []
        for index, candidate in enumerate(candidates):
            if index in consumed or not _NUMBER_RE.search(candidate.text):
                continue
            snippet = candidate.text[:MAX_SNIPPET_CHARS]
            key = snippet.lower()
            if key in seen:
                continue
            seen.add(key)
            unmatched.append(f"p.{candidate.page}: {snippet}")
            if len(unmatched) >= MAX_UNMATCHED:
                break
        return unmatched


def _clean(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\x00", "")).strip()


def build_document_extraction_service(max_size_bytes: int) -> DocumentExtractionService:
    return DocumentExtractionService(max_size_bytes=max_size_bytes)
