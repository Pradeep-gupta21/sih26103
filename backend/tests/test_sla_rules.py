from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import sla_rules_config as config
from app.main import app
from app.schemas.project import ProjectRecord
from app.services.notification_service import NotificationSettings
from app.services.sla_rules_service import RULE_DEFINITIONS, SlaRulesService


class _Registry:
    def __init__(self, projects: list[ProjectRecord]) -> None:
        self.projects = projects

    def get_project(self, project_id: str) -> ProjectRecord | None:
        return next((p for p in self.projects if p.project_id == project_id), None)


def _project(**overrides) -> ProjectRecord:
    base = dict(
        project_id="T-1", sector="Roads", state="Bihar", original_cost=100, revised_cost=100,
        planned_duration_months=40, project_age_months=20, physical_progress=50, financial_progress=50,
        milestones_total=10, milestones_delayed=0, land_acquisition_pending=False, clearance_pending=False,
        funding_issue=False, contractor_issue=False, previous_schedule_deviation=0,
    )
    return ProjectRecord.model_validate({**base, **overrides})


def _service(*projects: ProjectRecord) -> SlaRulesService:
    settings = NotificationSettings(enabled=False, auth_key="", template_id="", sender_id="", recipient="")
    return SlaRulesService(_Registry(list(projects)), settings)


def test_clean_project_passes_every_rule_with_values_reported():
    report = _service(_project()).evaluate(_project())
    assert report.overall_status == "PASS" and report.breached_rules == 0 and report.alert_preview is None
    assert [r.rule_id for r in report.results] == [d.id for d in RULE_DEFINITIONS]
    assert all(not r.breached and r.severity is None for r in report.results)
    assert {r.rule_id: r.measured_value for r in report.results} == {
        "schedule_overrun": -20.0, "cost_escalation": 0.0, "progress_shortfall": 0.0,
        "reporting_divergence": 0.0, "milestone_slippage": 0.0,
    }


@pytest.mark.parametrize(
    "overrides, rule_id, measured",
    [
        ({"project_age_months": 41, "physical_progress": 100, "financial_progress": 100}, "schedule_overrun", 1.0),
        ({"revised_cost": 111}, "cost_escalation", 11.0),
        ({"project_age_months": 40, "physical_progress": 70, "financial_progress": 70}, "progress_shortfall", 30.0),
        ({"financial_progress": 30}, "reporting_divergence", 20.0),
        ({"milestones_delayed": 3}, "milestone_slippage", 30.0),
    ],
)
def test_each_rule_breaches_on_its_own_fields(overrides, rule_id, measured):
    project = _project(**overrides)
    report = _service(project).evaluate(project)
    by_id = {r.rule_id: r for r in report.results}
    assert by_id[rule_id].breached and by_id[rule_id].measured_value == measured
    assert by_id[rule_id].threshold == next(d.threshold for d in RULE_DEFINITIONS if d.id == rule_id)
    assert [r.rule_id for r in report.results if r.breached] == [rule_id]
    assert report.alert_preview is not None and report.alert_preview.dispatched is False
    assert report.alert_preview.rule_id == rule_id and report.alert_preview.delivery_enabled is False


def test_severity_and_ordering():
    done = {"physical_progress": 100, "financial_progress": 100}
    warning = _project(project_id="W", project_age_months=41, **done)  # 1 month over: WARNING
    critical = _project(project_id="C", project_age_months=40 + int(config.CRITICAL_OVERRUN_MONTHS), **done)
    clean = _project(project_id="P")
    listing = _service(warning, critical, clean).breaches()
    assert listing.summary.projects_evaluated == 3 and listing.summary.projects_in_breach == 2 and listing.summary.projects_passing == 1
    assert [row.project_id for row in listing.rows] == ["C", "W"]
    assert listing.rows[0].worst_severity == "CRITICAL" and listing.rows[1].worst_severity == "WARNING"
    assert listing.passing_project_ids == ["P"]
    assert listing.summary.breaches_by_rule["schedule_overrun"] == 2


def test_rule_filter_and_unknown_rule():
    over = _project(project_id="A", project_age_months=41, physical_progress=100, financial_progress=100)
    cost = _project(project_id="B", revised_cost=130)
    service = _service(over, cost)
    assert [row.project_id for row in service.breaches(rule_filter="cost_escalation").rows] == ["B"]
    assert service.breaches(rule_filter="cost_escalation").summary.breaches_by_rule["schedule_overrun"] == 1
    with pytest.raises(ValueError):
        service.breaches(rule_filter="nope")


def test_endpoints_over_the_real_registry_and_model_untouched():
    with TestClient(app) as client:
        listing = client.get("/api/v1/sla/breaches?limit=2").json()
        assert listing["summary"]["projects_evaluated"] == 5000
        assert listing["summary"]["projects_in_breach"] + listing["summary"]["projects_passing"] == 5000
        assert listing["summary"]["delivery_enabled"] is False
        row = listing["rows"][0]
        assert row["worst_rule"]["measured_value"] > row["worst_rule"]["threshold"]
        report = client.get(f"/api/v1/sla/projects/{row['project_id']}").json()
        assert report["overall_status"] == "BREACH" and report["alert_preview"]["dispatched"] is False
        assert client.get("/api/v1/sla/projects/NOPE").status_code == 404
        assert client.get("/api/v1/sla/breaches?rule=nope").status_code == 422
        assert [r["id"] for r in client.get("/api/v1/sla/rules").json()] == [d.id for d in RULE_DEFINITIONS]

        # The SLA module never touches the prediction path: same payload, same probability.
        payload = {k: v for k, v in client.get("/api/v1/projects/PAI-00002").json().items() if k != "project_id"}
        before = client.post("/api/v1/predict-risk", json=payload).json()
        client.get("/api/v1/sla/projects/PAI-00002")
        client.get("/api/v1/sla/breaches")
        after = client.post("/api/v1/predict-risk", json=payload).json()
        assert before == after
