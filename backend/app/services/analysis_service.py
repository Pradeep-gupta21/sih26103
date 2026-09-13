"""Saved document analyses: SQLite (stdlib) store, separate from the project registry.

These are records a person produced from an uploaded document and chose to keep. They
are not PAIMANA project rows and never flow into projects.csv or the /projects endpoints.
The confirmed input and the pipeline result are stored as JSON documents; the handful of
columns alongside them exist only so the list view needs no payload parsing.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import threading
import uuid

from app.schemas.analysis import SavedAnalysis, SavedAnalysisCreate, SavedAnalysisSummary

DEFAULT_DB_PATH = Path(os.getenv("SAVED_ANALYSES_DB", Path(__file__).resolve().parents[2] / "data" / "saved_analyses.db"))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS saved_analyses (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    document_filename  TEXT NOT NULL,
    document_pages     INTEGER NOT NULL,
    saved_at           TEXT NOT NULL,
    risk_percentage    INTEGER NOT NULL,
    risk_level         TEXT NOT NULL,
    edited_field_count INTEGER NOT NULL,
    confirmed_values   TEXT NOT NULL,   -- JSON: ProjectRiskRequest + latitude/longitude
    field_metadata     TEXT NOT NULL,   -- JSON: {field: {confidence, edited, source_snippet, page}}
    result             TEXT NOT NULL    -- JSON: ProjectIntelligenceResponse
);
CREATE INDEX IF NOT EXISTS saved_analyses_saved_at ON saved_analyses (saved_at DESC);
"""


class AnalysisNotFoundError(LookupError):
    pass


class AnalysisService:
    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # One connection, serialised by a lock: the store is small and every write is a
        # single short statement, so this is simpler and safer than a pool.
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock, self._conn:
            self._conn.executescript(_SCHEMA)

    def create(self, payload: SavedAnalysisCreate) -> SavedAnalysis:
        record = SavedAnalysis(
            id=f"ANL-{uuid.uuid4().hex[:10].upper()}",
            saved_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            **payload.model_dump(),
        )
        confirmed = {
            **record.confirmed_values.model_dump(exclude={"project_id"}),
            "latitude": record.latitude,
            "longitude": record.longitude,
        }
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO saved_analyses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record.id,
                    record.name,
                    record.document.filename,
                    record.document.page_count,
                    record.saved_at,
                    record.result.project_risk.risk_percentage,
                    record.result.project_risk.risk_level,
                    sum(1 for meta in record.field_metadata.values() if meta.edited),
                    json.dumps(confirmed),
                    json.dumps({name: meta.model_dump() for name, meta in record.field_metadata.items()}),
                    record.result.model_dump_json(),
                ),
            )
        return record

    def list(self) -> list[SavedAnalysisSummary]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, name, document_filename, saved_at, risk_percentage, risk_level, edited_field_count "
                "FROM saved_analyses ORDER BY saved_at DESC, rowid DESC"
            ).fetchall()
        return [
            SavedAnalysisSummary(
                id=row["id"],
                name=row["name"],
                document_filename=row["document_filename"],
                saved_at=row["saved_at"],
                risk_percentage=row["risk_percentage"],
                risk_level=row["risk_level"],
                edited_field_count=row["edited_field_count"],
            )
            for row in rows
        ]

    def get(self, analysis_id: str) -> SavedAnalysis:
        with self._lock:
            row = self._conn.execute("SELECT * FROM saved_analyses WHERE id = ?", (analysis_id,)).fetchone()
        if row is None:
            raise AnalysisNotFoundError(analysis_id)
        confirmed = json.loads(row["confirmed_values"])
        latitude = confirmed.pop("latitude", None)
        longitude = confirmed.pop("longitude", None)
        return SavedAnalysis(
            id=row["id"],
            name=row["name"],
            saved_at=row["saved_at"],
            document={"filename": row["document_filename"], "page_count": row["document_pages"]},
            confirmed_values=confirmed,
            latitude=latitude,
            longitude=longitude,
            field_metadata=json.loads(row["field_metadata"]),
            result=json.loads(row["result"]),
        )

    def delete(self, analysis_id: str) -> None:
        with self._lock, self._conn:
            cursor = self._conn.execute("DELETE FROM saved_analyses WHERE id = ?", (analysis_id,))
        if cursor.rowcount == 0:
            raise AnalysisNotFoundError(analysis_id)

    def close(self) -> None:
        with self._lock:
            self._conn.close()


def build_analysis_service(db_path: Path | str = DEFAULT_DB_PATH) -> AnalysisService:
    return AnalysisService(db_path)
