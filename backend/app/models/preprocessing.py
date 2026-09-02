from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

BASE_NUMERIC_FEATURES = [
    "original_cost",
    "revised_cost",
    "planned_duration_months",
    "project_age_months",
    "physical_progress",
    "financial_progress",
    "milestones_total",
    "milestones_delayed",
    "land_acquisition_pending",
    "clearance_pending",
    "funding_issue",
    "contractor_issue",
    "previous_schedule_deviation",
]
CATEGORICAL_FEATURES = ["sector", "state"]
ENGINEERED_FEATURES = [
    "cost_overrun_percentage",
    "financial_physical_gap",
    "milestone_delay_ratio",
    "project_age_ratio",
]
MODEL_FEATURES = BASE_NUMERIC_FEATURES + ENGINEERED_FEATURES + CATEGORICAL_FEATURES


class ProjectFeatureEngineer(BaseEstimator, TransformerMixin):
    """Create model features from the raw project schema."""

    def fit(self, X: pd.DataFrame, y: Any = None) -> "ProjectFeatureEngineer":
        self.feature_names_out_ = np.asarray(MODEL_FEATURES, dtype=object)
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        frame = X.copy()
        required = set(BASE_NUMERIC_FEATURES + CATEGORICAL_FEATURES)
        missing = required.difference(frame.columns)
        if missing:
            raise ValueError(f"Input data is missing columns: {sorted(missing)}")

        original_cost = pd.to_numeric(frame["original_cost"], errors="coerce")
        revised_cost = pd.to_numeric(frame["revised_cost"], errors="coerce")
        duration = pd.to_numeric(frame["planned_duration_months"], errors="coerce")
        frame["cost_overrun_percentage"] = np.where(
            original_cost > 0,
            ((revised_cost - original_cost) / original_cost) * 100,
            0.0,
        )
        frame["financial_physical_gap"] = (
            pd.to_numeric(frame["physical_progress"], errors="coerce")
            - pd.to_numeric(frame["financial_progress"], errors="coerce")
        )
        frame["milestone_delay_ratio"] = np.divide(
            pd.to_numeric(frame["milestones_delayed"], errors="coerce"),
            pd.to_numeric(frame["milestones_total"], errors="coerce"),
            out=np.zeros(len(frame), dtype=float),
            where=pd.to_numeric(frame["milestones_total"], errors="coerce").to_numpy() > 0,
        )
        frame["project_age_ratio"] = np.divide(
            pd.to_numeric(frame["project_age_months"], errors="coerce"),
            duration,
            out=np.zeros(len(frame), dtype=float),
            where=duration.to_numpy() > 0,
        )
        return frame[MODEL_FEATURES]

    def get_feature_names_out(self, input_features: Any = None) -> np.ndarray:
        return np.asarray(MODEL_FEATURES, dtype=object)
