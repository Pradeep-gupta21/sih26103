from __future__ import annotations

from typing import Any

import shap

from app.models.prediction_model import DelayRiskModel

FEATURE_LABELS = {
    "land_acquisition_pct": "Land acquisition",
    "milestone_slippage_count": "Milestone slippage",
    "financial_progress_gap_pct": "Financial progress gap",
    "pending_clearances_count": "Pending clearances",
    "contractual_issues_count": "Contractual issues",
    "months_elapsed": "Project age",
}


def explain_prediction(model: DelayRiskModel, features: dict[str, Any]) -> list[dict[str, Any]]:
    explainer = shap.TreeExplainer(model.model)
    shap_values = explainer.shap_values(model.feature_frame(features))
    values = shap_values[0] if not isinstance(shap_values, list) else shap_values[1][0]
    ranked = sorted(zip(model.feature_frame(features).columns, values), key=lambda item: abs(float(item[1])), reverse=True)
    explanations = []
    for feature, contribution in ranked:
        contribution_value = float(contribution)
        if abs(contribution_value) < 0.01:
            continue
        value = float(features[feature])
        direction = "increases risk" if contribution_value > 0 else "reduces risk"
        explanations.append({
            "feature": FEATURE_LABELS[feature],
            "value": value,
            "contribution": round(contribution_value, 4),
            "direction": direction,
            "explanation": _explain(feature, value, contribution_value),
        })
    return explanations[:5]


def _explain(feature: str, value: float, contribution: float) -> str:
    if feature == "land_acquisition_pct":
        return f"Only {value:.0f}% of land is acquired, leaving unresolved right-of-way exposure." if contribution > 0 else f"Land acquisition is {value:.0f}% complete and is limiting risk."
    if feature == "milestone_slippage_count":
        return f"{value:.0f} milestones are behind plan and are extending the critical path." if contribution > 0 else "Milestone delivery is currently close to plan."
    if feature == "financial_progress_gap_pct":
        return f"Financial progress is {abs(value):.0f}% below the expected trajectory." if value > 0 else "Financial progress is tracking near the expected trajectory."
    if feature == "pending_clearances_count":
        return f"{value:.0f} pending clearances are blocking downstream work packages." if contribution > 0 else "Clearance dependencies are not currently material."
    if feature == "contractual_issues_count":
        return f"{value:.0f} contractual issues add execution uncertainty." if contribution > 0 else "Contractual issues are not currently adding material risk."
    return f"Project age of {value:.0f} months contributes to the current risk assessment."
