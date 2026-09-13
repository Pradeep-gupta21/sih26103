"""Fit and save the historical nearest-neighbor similarity artifact."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models.similarity_model import HistoricalSimilarityModel

DATA_PATH = ROOT / "data" / "historical_projects.csv"
MODEL_PATH = ROOT / "trained_models" / "similarity_pipeline" / "historical_similarity.joblib"


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Historical data not found: {DATA_PATH}")
    HistoricalSimilarityModel.train(pd.read_csv(DATA_PATH), MODEL_PATH)
    print(f"Saved similarity artifact to {MODEL_PATH}")


if __name__ == "__main__":
    main()
