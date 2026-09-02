"""Train and save the production delay-risk preprocessing/model pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.preprocessing import CATEGORICAL_FEATURES, ENGINEERED_FEATURES, BASE_NUMERIC_FEATURES, ProjectFeatureEngineer

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "projects.csv"
MODEL_DIR = ROOT / "trained_models"
MODEL_PATH = MODEL_DIR / "delay_risk_pipeline.joblib"
METRICS_PATH = MODEL_DIR / "delay_risk_metrics.json"
TARGET = "is_delayed"
REQUIRED_COLUMNS = {"project_id", "sector", "state", TARGET, *BASE_NUMERIC_FEATURES}


def load_dataset() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
    data = pd.read_csv(DATA_PATH)
    missing = REQUIRED_COLUMNS.difference(data.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")
    data = data.dropna(subset=[TARGET]).copy()
    if data.empty:
        raise ValueError("Dataset has no rows after removing missing targets")
    if not set(data[TARGET].unique()).issubset({0, 1}):
        raise ValueError(f"{TARGET} must contain only 0 and 1")
    return data


def build_pipeline() -> Pipeline:
    numeric_features = BASE_NUMERIC_FEATURES + ENGINEERED_FEATURES
    numeric_pipeline = Pipeline([("imputer", SimpleImputer(strategy="median"))])
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=True)),
    ])
    preprocessor = ColumnTransformer([
        ("numeric", numeric_pipeline, numeric_features),
        ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
    ])
    classifier = XGBClassifier(
        n_estimators=240,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=1,
    )
    return Pipeline([
        ("feature_engineering", ProjectFeatureEngineer()),
        ("preprocessing", preprocessor),
        ("classifier", classifier),
    ])


def main() -> None:
    data = load_dataset()
    X = data.drop(columns=[TARGET, "project_id"])
    y = data[TARGET].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    probabilities = pipeline.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, predictions, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, predictions, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "feature_count_before_encoding": len(BASE_NUMERIC_FEATURES + ENGINEERED_FEATURES + CATEGORICAL_FEATURES),
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")

    print(f"Saved pipeline: {MODEL_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")
    print("Metrics:")
    for name, value in metrics.items():
        print(f"  {name}: {value}")
    print("\nClassification report:")
    print(classification_report(y_test, predictions, target_names=["not delayed", "delayed"], zero_division=0))


if __name__ == "__main__":
    main()
