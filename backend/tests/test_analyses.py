from __future__ import annotations

from pathlib import Path
import tempfile

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.analysis_service import AnalysisService

PROJECT = {
    "sector": "Railways", "state": "Uttar Pradesh", "original_cost": 5000, "revised_cost": 5400,
    "planned_duration_months": 48, "project_age_months": 36, "physical_progress": 52, "financial_progress": 41,
    "milestones_total": 20, "milestones_delayed": 6, "land_acquisition_pending": True, "clearance_pending": False,
    "funding_issue": True, "contractor_issue": False, "previous_schedule_deviation": 5,
}


@pytest.fixture
def client():
    with tempfile.TemporaryDirectory() as tmp:
        with TestClient(app) as test_client:
            app.state.analysis_service = AnalysisService(Path(tmp) / "test.db")
            yield test_client
            app.state.analysis_service.close()


def _payload(client: TestClient, name: str = "Test analysis") -> dict:
    result = client.post("/api/v1/project-intelligence", json={**PROJECT, "latitude": 21.2, "longitude": 78.2}).json()
    metadata = {field: {"confidence": "high", "edited": False} for field in PROJECT}
    metadata["milestones_delayed"] = {"confidence": None, "edited": True, "source_snippet": None, "page": None}
    metadata["funding_issue"] = {"confidence": "low", "edited": True, "source_snippet": "Funding status: shortfall", "page": 1}
    return {
        "name": name,
        "document": {"filename": "dpr.pdf", "page_count": 3},
        "confirmed_values": PROJECT,
        "latitude": 21.2,
        "longitude": 78.2,
        "field_metadata": metadata,
        "result": result,
    }


def test_create_list_get_delete_round_trip(client: TestClient):
    assert client.get("/api/v1/analyses").json() == []

    payload = _payload(client, "Corridor DPR")
    created = client.post("/api/v1/analyses", json=payload)
    assert created.status_code == 201, created.text
    record = created.json()
    assert record["id"].startswith("ANL-") and record["saved_at"]

    listed = client.get("/api/v1/analyses").json()
    assert len(listed) == 1
    summary = listed[0]
    assert summary["name"] == "Corridor DPR"
    assert summary["document_filename"] == "dpr.pdf"
    assert summary["edited_field_count"] == 2
    assert summary["risk_percentage"] == payload["result"]["project_risk"]["risk_percentage"]
    assert "result" not in summary and "confirmed_values" not in summary

    fetched = client.get(f"/api/v1/analyses/{record['id']}").json()
    assert fetched["result"] == payload["result"]
    assert {k: fetched["confirmed_values"][k] for k in PROJECT} == {
        k: (float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and k in {"original_cost", "revised_cost", "physical_progress", "financial_progress", "previous_schedule_deviation"} else v)
        for k, v in PROJECT.items()
    }
    assert fetched["latitude"] == 21.2 and fetched["field_metadata"]["funding_issue"]["edited"] is True

    assert client.delete(f"/api/v1/analyses/{record['id']}").status_code == 200
    assert client.get("/api/v1/analyses").json() == []
    assert client.get(f"/api/v1/analyses/{record['id']}").status_code == 404
    assert client.delete(f"/api/v1/analyses/{record['id']}").status_code == 404


def test_list_is_newest_first(client: TestClient):
    for name in ("first", "second", "third"):
        assert client.post("/api/v1/analyses", json=_payload(client, name)).status_code == 201
    assert [item["name"] for item in client.get("/api/v1/analyses").json()] == ["third", "second", "first"]


def test_rejects_invalid_confirmed_values(client: TestClient):
    payload = _payload(client)
    payload["confirmed_values"] = {**PROJECT, "milestones_delayed": 99}
    assert client.post("/api/v1/analyses", json=payload).status_code == 422


def test_saved_analyses_never_appear_in_project_registry(client: TestClient):
    client.post("/api/v1/analyses", json=_payload(client, "not a project"))
    ids = {project["project_id"] for project in client.get("/api/v1/projects?search=ANL-").json()}
    assert not any(pid.startswith("ANL-") for pid in ids)
