"""Generate reproducible synthetic infrastructure project data."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20260903
PROJECT_COUNT = 5000
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "projects.csv"

SECTORS = [
    "Railways", "Roads", "Urban Transit", "Water & Sanitation",
    "Power", "Ports", "Airports", "Industrial Corridors",
]
STATES = [
    "Uttar Pradesh", "Maharashtra", "Rajasthan", "Karnataka", "Tamil Nadu",
    "Gujarat", "Madhya Pradesh", "West Bengal", "Odisha", "Bihar",
    "Andhra Pradesh", "Telangana", "Kerala", "Haryana", "Jharkhand",
]


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-values))


def generate_projects(count: int = PROJECT_COUNT, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    age = rng.integers(6, 85, size=count)
    planned_duration = np.clip(rng.normal(42, 16, size=count), 12, 120).round().astype(int)
    sector = rng.choice(SECTORS, size=count, p=[.18, .18, .16, .14, .11, .07, .06, .10])
    state = rng.choice(STATES, size=count)

    # Progress is primarily age-driven, with realistic reporting noise.
    expected_progress = np.clip(age / planned_duration * 100, 4, 98)
    physical_progress = np.clip(expected_progress + rng.normal(0, 8, count), 1, 100).round(1)
    financial_progress = np.clip(physical_progress + rng.normal(0, 9, count), 0, 100).round(1)

    milestones_total = np.clip(np.round(planned_duration / 4 + rng.normal(0, 2, count)), 4, 32).astype(int)
    baseline_slippage = np.clip((physical_progress - expected_progress) / 18, -1, 3)
    milestones_delayed = np.clip(np.round(rng.poisson(0.8 + np.maximum(baseline_slippage, 0) * 1.2)), 0, milestones_total - 1).astype(int)

    # Binary dependencies are correlated with project age and sector complexity.
    complex_sector = np.isin(sector, ["Railways", "Roads", "Industrial Corridors", "Ports"])
    age_pressure = np.clip((age - 24) / 60, 0, 1)
    land_acquisition_pending = rng.binomial(1, np.clip(.12 + .26 * complex_sector + .20 * age_pressure, .05, .72))
    clearance_pending = rng.binomial(1, np.clip(.10 + .10 * complex_sector + .13 * age_pressure, .04, .52))
    funding_issue = rng.binomial(1, np.clip(.08 + .13 * (financial_progress < physical_progress - 12) + .10 * age_pressure, .03, .46))
    contractor_issue = rng.binomial(1, np.clip(.09 + .12 * (milestones_delayed >= 2) + .07 * complex_sector, .03, .45))

    previous_schedule_deviation = np.clip(
        rng.normal(-1.0 + milestones_delayed * 2.8 + age_pressure * 2.5, 4.5, count), -12, 36
    ).round(1)
    progress_gap = np.maximum(physical_progress - financial_progress, 0)
    cost_base = np.exp(rng.normal(np.log(250), .85, count)).round(1)
    original_cost = np.clip(cost_base, 25, 50000).round(1)

    # A latent score creates realistic overlap; the final draw adds controlled randomness.
    latent_risk = (
        -2.15
        + milestones_delayed * .42
        + land_acquisition_pending * 1.30
        + clearance_pending * .72
        + funding_issue * .82
        + contractor_issue * .62
        + np.clip(previous_schedule_deviation, 0, None) * .075
        + progress_gap * .035
        + np.maximum(financial_progress - physical_progress, 0) * .012
        + age_pressure * .30
        + rng.normal(0, .42, count)
    )
    delay_probability = np.clip(sigmoid(latent_risk), .03, .97)
    is_delayed = rng.binomial(1, delay_probability)

    cost_overrun_rate = np.clip(
        .025
        + np.clip(delay_probability - .35, 0, .62) * .22
        + funding_issue * .025
        + contractor_issue * .018
        + rng.normal(0, .015, count),
        0,
        .38,
    )
    revised_cost = (original_cost * (1 + cost_overrun_rate)).round(1)

    return pd.DataFrame({
        "project_id": [f"PAI-{index:05d}" for index in range(1, count + 1)],
        "sector": sector,
        "state": state,
        "original_cost": original_cost,
        "revised_cost": revised_cost,
        "planned_duration_months": planned_duration,
        "project_age_months": age,
        "physical_progress": physical_progress,
        "financial_progress": financial_progress,
        "milestones_total": milestones_total,
        "milestones_delayed": milestones_delayed,
        "land_acquisition_pending": land_acquisition_pending,
        "clearance_pending": clearance_pending,
        "funding_issue": funding_issue,
        "contractor_issue": contractor_issue,
        "previous_schedule_deviation": previous_schedule_deviation,
        "is_delayed": is_delayed,
    })


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    dataset = generate_projects()
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"Generated {len(dataset):,} projects at {OUTPUT_PATH}")
    print(f"Delayed class rate: {dataset['is_delayed'].mean():.1%}")


if __name__ == "__main__":
    main()
