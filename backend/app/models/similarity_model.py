from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.models.preprocessing import BASE_NUMERIC_FEATURES, CATEGORICAL_FEATURES, ENGINEERED_FEATURES, ProjectFeatureEngineer

RAW_FEATURES = BASE_NUMERIC_FEATURES + CATEGORICAL_FEATURES


class HistoricalSimilarityModel:
    def __init__(self, artifact_path: Path) -> None:
        if not artifact_path.exists():
            raise FileNotFoundError(f"Similarity model not found: {artifact_path}")
        artifact = joblib.load(artifact_path)
        if not isinstance(artifact, dict) or not {"pipeline", "neighbors", "historical"}.issubset(artifact):
            raise ValueError("Saved similarity artifact is not compatible")
        self.pipeline: Pipeline = artifact["pipeline"]
        self.neighbors: NearestNeighbors = artifact["neighbors"]
        self.historical: pd.DataFrame = artifact["historical"]

    @classmethod
    def train(cls, historical: pd.DataFrame, artifact_path: Path) -> None:
        missing = set(RAW_FEATURES + ["project_id", "actual_delay_months", "primary_delay_cause"]).difference(historical.columns)
        if missing:
            raise ValueError(f"Historical data is missing columns: {sorted(missing)}")
        numeric_features = BASE_NUMERIC_FEATURES + ENGINEERED_FEATURES
        preprocessor = ColumnTransformer([
            ("numeric", Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scale", StandardScaler()),
            ]), numeric_features),
            ("categorical", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore")),
            ]), CATEGORICAL_FEATURES),
        ])
        pipeline = Pipeline([("feature_engineering", ProjectFeatureEngineer()), ("preprocessing", preprocessor)])
        features = historical[RAW_FEATURES].copy()
        matrix = pipeline.fit_transform(features)
        neighbors = NearestNeighbors(n_neighbors=min(10, len(historical)), metric="euclidean", algorithm="brute")
        neighbors.fit(matrix)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"pipeline": pipeline, "neighbors": neighbors, "historical": historical.reset_index(drop=True)}, artifact_path)

    def find_matches(self, project: dict[str, Any], limit: int = 3) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        frame = pd.DataFrame([project], columns=RAW_FEATURES)
        transformed = self.pipeline.transform(frame)
        distances, indices = self.neighbors.kneighbors(transformed, n_neighbors=min(limit, len(self.historical)))
        matches = []
        for distance, index in zip(distances[0], indices[0]):
            record = self.historical.iloc[int(index)]
            similarity = float(np.clip(100 / (1 + distance / 4), 0, 100))
            matches.append({
                "project_id": str(record["project_id"]),
                "similarity_percentage": round(similarity, 1),
                "sector": str(record["sector"]),
                "state": str(record["state"]),
                "original_cost": float(record["original_cost"]),
                "revised_cost": float(record.get("revised_cost", record["original_cost"])),
                "actual_delay_months": int(record["actual_delay_months"]),
                "actual_outcome": str(record["actual_outcome"]),
                "primary_delay_cause": str(record["primary_delay_cause"]),
            })
        selected = self.historical.iloc[indices[0][:limit]]
        delayed_count = int((selected["actual_delay_months"] > 0).sum())
        over_six = int((selected["actual_delay_months"] > 6).sum())
        evidence = {
            "similar_projects_count": len(selected),
            "delayed_projects_count": delayed_count,
            "delayed_over_six_months_count": over_six,
            "delay_rate": round(delayed_count / len(selected), 4) if len(selected) else 0.0,
            "summary": f"{delayed_count} of {len(selected)} similar projects experienced delays; {over_six} exceeded 6 months.",
        }
        return matches, evidence


def build_similarity_model(artifact_path: Path) -> HistoricalSimilarityModel:
    return HistoricalSimilarityModel(artifact_path)
