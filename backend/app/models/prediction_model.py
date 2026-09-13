from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from xgboost import XGBClassifier

FEATURE_COLUMNS = [
    "land_acquisition_pct",
    "milestone_slippage_count",
    "financial_progress_gap_pct",
    "pending_clearances_count",
    "contractual_issues_count",
    "months_elapsed",
]
TARGET_COLUMN = "delay_risk"
MODEL_VERSION = "delay-risk-xgb-v1"


class DelayRiskModel:
    def __init__(self, data_path: Path) -> None:
        self.data_path = data_path
        self.model = self._train()

    def _train(self) -> XGBClassifier:
        if not self.data_path.exists():
            raise FileNotFoundError(f"Training data not found: {self.data_path}")
        data = pd.read_csv(self.data_path)
        required = set(FEATURE_COLUMNS + [TARGET_COLUMN])
        missing = required.difference(data.columns)
        if missing:
            raise ValueError(f"Training data is missing columns: {sorted(missing)}")
        if len(data) < 10:
            raise ValueError("Training data must contain at least 10 rows")
        if data[TARGET_COLUMN].nunique() < 2:
            raise ValueError("Training data must contain both risk classes")

        estimator = XGBClassifier(
            n_estimators=120,
            max_depth=3,
            learning_rate=0.06,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
            n_jobs=1,
        )
        estimator.fit(data[FEATURE_COLUMNS], data[TARGET_COLUMN])
        return estimator

    def predict_probability(self, features: dict[str, Any]) -> float:
        frame = pd.DataFrame([features], columns=FEATURE_COLUMNS)
        return float(self.model.predict_proba(frame)[0, 1])

    def feature_frame(self, features: dict[str, Any]) -> pd.DataFrame:
        return pd.DataFrame([features], columns=FEATURE_COLUMNS)
