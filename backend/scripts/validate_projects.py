"""Print basic quality checks for the generated project dataset."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "projects.csv"
EXPECTED_COLUMNS = [
    "project_id", "sector", "state", "original_cost", "revised_cost",
    "planned_duration_months", "project_age_months", "physical_progress",
    "financial_progress", "milestones_total", "milestones_delayed",
    "land_acquisition_pending", "clearance_pending", "funding_issue",
    "contractor_issue", "previous_schedule_deviation", "is_delayed",
]


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}. Run generate_projects.py first.")

    data = pd.read_csv(DATA_PATH)
    missing_columns = sorted(set(EXPECTED_COLUMNS) - set(data.columns))
    if missing_columns:
        raise ValueError(f"Missing expected columns: {missing_columns}")
    if data[EXPECTED_COLUMNS].isna().any().any():
        raise ValueError("Dataset contains missing values")
    if not set(data["is_delayed"].unique()).issubset({0, 1}):
        raise ValueError("is_delayed must contain only 0 and 1")

    class_rate = data["is_delayed"].mean()
    if not .15 <= class_rate <= .85:
        raise ValueError(f"Class balance is outside the expected range: {class_rate:.1%}")

    print("Dataset shape:", data.shape)
    print("\nMissing values:")
    print(data.isna().sum().to_string())
    print("\nClass distribution:")
    print(data["is_delayed"].value_counts().sort_index().rename(index={0: "not delayed", 1: "delayed"}).to_string())
    print("\nClass proportions:")
    print(data["is_delayed"].value_counts(normalize=True).sort_index().round(4).to_string())
    print("\nBasic statistics:")
    print(data.describe(include="all").transpose().to_string())
    print("\nRisk relationship checks:")
    print(data.groupby("land_acquisition_pending")["is_delayed"].mean().rename("delay_rate").to_string())
    print(data.groupby("funding_issue")["is_delayed"].mean().rename("delay_rate").to_string())


if __name__ == "__main__":
    main()
