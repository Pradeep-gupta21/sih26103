from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.pipeline import Pipeline

from app.schemas.project import ProjectRiskRequest, ProjectRiskResponse, ProjectRiskSummary
from app.services.explanation_service import build_explainer, explain_prediction

MODEL_PATH = Path(__file__).resolve().parents[2] / "trained_models" / "delay_risk_pipeline.joblib"


class SavedPredictionService:
    """Load and serve the already-trained pipeline without retraining."""

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"Trained model not found: {model_path}")
        loaded = joblib.load(model_path)
        if not isinstance(loaded, Pipeline) or "classifier" not in loaded.named_steps:
            raise ValueError("Saved model is not a compatible prediction pipeline")
        self.pipeline = loaded
        self.model_path = model_path
        self.explainer = build_explainer(self.pipeline)

    def predict(self, payload: ProjectRiskRequest) -> ProjectRiskResponse:
        features = payload.model_dump(exclude={"project_id"})
        probability = float(self.pipeline.predict_proba(pd.DataFrame([features]))[0, 1])
        percentage = round(probability * 100)
        if percentage <= 30:
            risk_level = "LOW"
        elif percentage <= 60:
            risk_level = "MODERATE"
        elif percentage <= 80:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        confidence, basis = self._confidence(probability)
        factors, summary = explain_prediction(self.pipeline, self.explainer, features)
        return ProjectRiskResponse(
            project_risk=ProjectRiskSummary(
                delay_probability=round(probability, 6),
                risk_percentage=percentage,
                risk_level=risk_level,
                model_confidence=confidence,
                confidence_basis=basis,
            ),
            top_risk_factors=factors,
            summary=summary,
        )

    @staticmethod
    def _confidence(probability: float) -> tuple[str, str]:
        distance = abs(probability - 0.5)
        if distance >= 0.3:
            return "HIGH", "Heuristic confidence: probability is at least 30 points from the decision boundary."
        if distance >= 0.15:
            return "MEDIUM", "Heuristic confidence: probability is 15-30 points from the decision boundary."
        return "LOW", "Heuristic confidence: probability is close to the decision boundary; review supporting evidence."


def build_prediction_service() -> SavedPredictionService:
    return SavedPredictionService()
