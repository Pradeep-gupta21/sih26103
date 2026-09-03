from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
import shap
from sklearn.pipeline import Pipeline

FACTOR_LABELS = {
    "land_acquisition_pending": "Land acquisition",
    "clearance_pending": "Pending clearances",
    "funding_issue": "Funding issues",
    "contractor_issue": "Contractor issues",
    "milestones_delayed": "Delayed milestones",
    "milestone_delay_ratio": "Milestone delay ratio",
    "financial_physical_gap": "Financial-physical progress gap",
    "cost_overrun_percentage": "Cost overrun",
    "previous_schedule_deviation": "Previous schedule deviation",
    "project_age_ratio": "Project age",
    "physical_progress": "Physical progress",
    "financial_progress": "Financial progress",
    "planned_duration_months": "Planned duration",
    "project_age_months": "Project age",
    "original_cost": "Original cost",
    "revised_cost": "Revised cost",
    "milestones_total": "Total milestones",
    "sector": "Sector",
    "state": "State",
}


def build_explainer(pipeline: Pipeline) -> shap.TreeExplainer:
    """Build once when the saved model is loaded, not once per request."""
    classifier = pipeline.named_steps["classifier"]
    return shap.TreeExplainer(classifier)


def explain_prediction(
    pipeline: Pipeline,
    explainer: shap.TreeExplainer,
    raw_features: dict[str, Any],
) -> tuple[list[dict[str, Any]], str]:
    raw_frame = pd.DataFrame([raw_features])
    transformed = pipeline[:-1].transform(raw_frame)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()
    shap_values = explainer.shap_values(transformed)
    values = np.asarray(shap_values[0] if not isinstance(shap_values, list) else shap_values[1][0], dtype=float)
    feature_names = pipeline.named_steps["preprocessing"].get_feature_names_out()
    logical_contributions: dict[str, float] = {}
    for encoded_name, contribution in zip(feature_names, values):
        logical_name = _logical_name(str(encoded_name))
        logical_contributions[logical_name] = logical_contributions.get(logical_name, 0.0) + float(contribution)

    ranked = sorted(logical_contributions.items(), key=lambda item: (-abs(item[1]), item[0]))
    total_absolute = sum(abs(value) for _, value in ranked) or 1.0
    top = []
    for factor, contribution in ranked[:5]:
        importance = round(abs(contribution) / total_absolute, 4)
        impact = "increases_risk" if contribution > 0 else "reduces_risk"
        top.append({
            "factor": factor,
            "impact": impact,
            "importance": importance,
            "description": _description(factor, raw_features, impact),
        })
    return top, _summary(top)


def _logical_name(encoded_name: str) -> str:
    name = encoded_name.split("__", 1)[-1]
    for categorical in ("sector", "state"):
        if name == categorical or name.startswith(f"{categorical}_"):
            return categorical
    return name


def _description(factor: str, features: dict[str, Any], impact: str) -> str:
    improving = impact == "reduces_risk"
    if factor == "land_acquisition_pending":
        return "Pending land acquisition is a major contributor to the predicted delay risk." if not improving else "Land acquisition status is currently reducing predicted delay risk."
    if factor in {"milestones_delayed", "milestone_delay_ratio"}:
        return "A high proportion of delayed milestones is increasing project risk." if not improving else "Milestones are tracking well enough to reduce project risk."
    if factor == "financial_physical_gap":
        return "A gap between physical and financial progress is increasing project risk." if not improving else "Financial and physical progress are aligned, reducing project risk."
    if factor == "clearance_pending":
        return "Pending clearances are increasing execution and schedule risk." if not improving else "Clearances are not currently adding material risk."
    if factor == "funding_issue":
        return "A reported funding issue is increasing the likelihood of delay." if not improving else "No reported funding issue is reducing predicted risk."
    if factor == "contractor_issue":
        return "A reported contractor issue is increasing delivery risk." if not improving else "No reported contractor issue is reducing predicted risk."
    label = FACTOR_LABELS.get(factor, factor.replace("_", " ").title())
    return f"{label} is contributing to the predicted risk." if not improving else f"{label} is currently reducing the predicted risk."


def _summary(factors: list[dict[str, Any]]) -> str:
    positive = [item["factor"] for item in factors if item["impact"] == "increases_risk"][:3]
    if not positive:
        return "The model found no dominant factors increasing the predicted delay risk."
    labels = [FACTOR_LABELS.get(item, item.replace("_", " ")) for item in positive]
    if len(labels) == 1:
        joined = labels[0]
    elif len(labels) == 2:
        joined = f"{labels[0]} and {labels[1]}"
    else:
        joined = f"{', '.join(labels[:-1])}, and {labels[-1]}"
    return f"The project is primarily at risk due to {joined.lower()}."
