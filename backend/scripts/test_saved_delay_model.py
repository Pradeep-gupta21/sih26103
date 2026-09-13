"""Load the saved pipeline and make one inference without retraining."""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
MODEL_PATH = ROOT / "trained_models" / "delay_risk_pipeline.joblib"
DATA_PATH = ROOT / "data" / "projects.csv"


def main() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Saved model not found: {MODEL_PATH}. Run train_delay_model.py first.")
    pipeline = joblib.load(MODEL_PATH)
    sample = pd.read_csv(DATA_PATH).drop(columns=["is_delayed", "project_id"]).iloc[[0]]
    probability = float(pipeline.predict_proba(sample)[0, 1])
    prediction = int(pipeline.predict(sample)[0])
    if not 0 <= probability <= 1:
        raise ValueError(f"Invalid probability: {probability}")
    print("Saved model loaded successfully")
    print(f"Prediction: {prediction}")
    print(f"Delay probability: {probability:.4f}")
    print("Preprocessing and inference: OK")


if __name__ == "__main__":
    main()
