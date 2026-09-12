from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.project import ProjectRiskRequest
from app.services.document_extraction_service import FIELD_ORDER, build_document_extraction_service

pdfplumber = pytest.importorskip("pdfplumber")
reportlab = pytest.importorskip("reportlab")


def _pdf(lines: list[str], table: list[list[str]] | None = None) -> bytes:
    """Build a small text PDF in memory so the tests exercise real pdfplumber parsing."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Table

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    story = [Paragraph(line, styles["Normal"]) for line in lines]
    if table:
        story.append(Table(table))
    SimpleDocTemplate(buffer, pagesize=A4).build(story)
    return buffer.getvalue()


WELL_LABELLED = _pdf(
    [
        "Sector: Railways",
        "State / UT: Uttar Pradesh",
        "Sanctioned cost: Rs. 5,000 crore",
        "Revised cost: Rs. 5,40,000 lakh",
        "Planned duration: 4 years",
        "Months elapsed since sanction: 36 months",
        "Site coordinates: Latitude 26.8467 N, Longitude 80.9462 E",
    ],
    [
        ["Indicator", "Value"],
        ["Physical progress", "52%"],
        ["Financial progress", "41%"],
        ["Total milestones", "20"],
        ["Milestones delayed", "6"],
        ["Schedule deviation", "5 %"],
        ["Land acquisition status", "Pending"],
        ["Statutory clearances", "Obtained"],
        ["Funding status", "Shortfall reported"],
        ["Contractor performance", "Satisfactory"],
    ],
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_field_list_matches_request_schema():
    expected = [name for name in ProjectRiskRequest.model_fields if name != "project_id"]
    assert FIELD_ORDER == expected


def test_well_labelled_document_extracts_every_field_with_units_normalised():
    service = build_document_extraction_service(20 * 1024 * 1024)
    result = service.extract("dpr.pdf", WELL_LABELLED)
    values = {item.field: item.value for item in result.fields}
    assert values == {
        "sector": "Railways",
        "state": "Uttar Pradesh",
        "original_cost": 5000.0,
        "revised_cost": 5400.0,  # lakh -> crore
        "planned_duration_months": 48,  # years -> months
        "project_age_months": 36,
        "physical_progress": 52.0,
        "financial_progress": 41.0,
        "milestones_total": 20,
        "milestones_delayed": 6,
        "land_acquisition_pending": True,
        "clearance_pending": False,
        "funding_issue": True,
        "contractor_issue": False,
        "previous_schedule_deviation": 5.0,
    }
    assert all(item.confidence == "high" for item in result.fields)
    assert all(item.source_snippet for item in result.fields)
    coords = {item.field: item.value for item in result.optional_fields}
    assert coords == {"latitude": 26.8467, "longitude": 80.9462}


def test_missing_fields_are_null_and_ambiguous_ones_are_low_confidence():
    service = build_document_extraction_service(20 * 1024 * 1024)
    document = _pdf(
        [
            "(All figures in Rs. crore)",
            "A four-lane highway bypass in the State of Chhattisgarh.",
            "Approved outlay: 1,250",
            "Revised outlay: 1,410 (first revision); Revised outlay: 1,520 (second revision)",
            "Completion period: 30",
            "Land acquisition: 65% complete",
            "Time overrun: 4 months",
        ]
    )
    result = service.extract("note.pdf", document)
    by_name = {item.field: item for item in result.fields}

    assert by_name["milestones_delayed"].value is None
    assert by_name["milestones_delayed"].confidence is None
    assert by_name["funding_issue"].value is None

    assert by_name["sector"].value == "Roads" and by_name["sector"].confidence == "low"
    assert by_name["state"].value == "Chhattisgarh" and by_name["state"].confidence == "low"
    assert by_name["original_cost"].value == 1250.0 and by_name["original_cost"].confidence == "high"
    assert by_name["revised_cost"].value == 1410.0 and by_name["revised_cost"].confidence == "low"
    assert by_name["planned_duration_months"].confidence == "low"
    assert by_name["land_acquisition_pending"].value is True and by_name["land_acquisition_pending"].confidence == "low"
    assert by_name["previous_schedule_deviation"].confidence == "low"


def test_extracted_values_produce_the_same_prediction_as_manual_input(client: TestClient):
    response = client.post(
        "/api/v1/documents/extract",
        files={"file": ("dpr.pdf", io.BytesIO(WELL_LABELLED), "application/pdf")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["field"] for item in body["fields"]] == FIELD_ORDER
    extracted = {item["field"]: item["value"] for item in body["fields"]}
    assert None not in extracted.values()

    manual = {
        "sector": "Railways", "state": "Uttar Pradesh", "original_cost": 5000, "revised_cost": 5400,
        "planned_duration_months": 48, "project_age_months": 36, "physical_progress": 52,
        "financial_progress": 41, "milestones_total": 20, "milestones_delayed": 6,
        "land_acquisition_pending": True, "clearance_pending": False, "funding_issue": True,
        "contractor_issue": False, "previous_schedule_deviation": 5,
    }
    from_pdf = client.post("/api/v1/project-intelligence", json=extracted)
    from_hand = client.post("/api/v1/project-intelligence", json=manual)
    assert from_pdf.status_code == from_hand.status_code == 200, from_pdf.text
    assert from_pdf.json() == from_hand.json()


def test_rejects_non_pdf_uploads(client: TestClient):
    wrong_extension = client.post(
        "/api/v1/documents/extract",
        files={"file": ("report.docx", io.BytesIO(b"hello"), "application/octet-stream")},
    )
    assert wrong_extension.status_code == 400

    not_a_pdf = client.post(
        "/api/v1/documents/extract",
        files={"file": ("report.pdf", io.BytesIO(b"hello"), "application/pdf")},
    )
    assert not_a_pdf.status_code == 422


def test_pdf_without_text_layer_returns_nulls_and_a_warning():
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    page = canvas.Canvas(buffer)
    page.showPage()
    page.save()
    service = build_document_extraction_service(20 * 1024 * 1024)
    result = service.extract("scan.pdf", buffer.getvalue())
    assert all(item.value is None for item in result.fields)
    assert any("No text layer" in warning for warning in result.warnings)
