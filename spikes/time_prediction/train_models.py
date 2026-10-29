"""
Model Training Spike for Approval-Time Prediction.

Trains 3 models on synthetic data and compares them:
  1. Median Baseline (always predicts the median)
  2. RandomForest Regressor
  3. Gradient Boosting (sklearn's HistGradientBoostingRegressor — XGBoost-like)

Reports MAE, Median Absolute Error, RMSE, and 80% prediction-interval coverage.

ALL MODELS TRAINED ON SYNTHETIC DATA — accuracy numbers are NOT real-world performance.
Random seed = 42 for full reproducibility.
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import (
        HistGradientBoostingRegressor,
        RandomForestRegressor,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        mean_absolute_error,
        median_absolute_error,
        root_mean_squared_error,
    )
    from sklearn.preprocessing import LabelEncoder
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Run: pip install scikit-learn pandas numpy")
    sys.exit(1)


RANDOM_SEED = 42
OUTPUT_DIR = Path(__file__).parent / "output"

# Features to use (matching the synthetic data generator)
CATEGORICAL_FEATURES = [
    "state", "bank", "verification_method", "doc_completeness",
    "officer_workload", "amount_bucket",
]

NUMERIC_FEATURES = [
    "amount", "tenure_months", "n_documents", "n_alerts",
    "is_renewal", "submission_dow", "escalation_level",
]

TARGETS = [
    "verification_turnaround_days",
    "release_turnaround_days",
]


def load_data() -> pd.DataFrame:
    """Load synthetic dataset."""
    json_path = OUTPUT_DIR / "synthetic_cases.json"
    if not json_path.exists():
        print("Dataset not found. Run generate_synthetic_data.py first.")
        sys.exit(1)

    with open(str(json_path), "r", encoding="utf-8") as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    return df


def prepare_features(df: pd.DataFrame) -> tuple[np.ndarray, dict[str, LabelEncoder]]:
    """Encode categorical features and return feature matrix."""
    encoders = {}

    df_encoded = df.copy()
    for col in CATEGORICAL_FEATURES:
        le = LabelEncoder()
        df_encoded[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    # Convert boolean to int
    df_encoded["is_renewal"] = df_encoded["is_renewal"].astype(int)
    df_encoded["has_alerts"] = df_encoded["has_alerts"].astype(int)

    feature_cols = CATEGORICAL_FEATURES + NUMERIC_FEATURES + ["has_alerts"]
    X = df_encoded[feature_cols].values

    return X, encoders, feature_cols


def train_and_evaluate(target_name: str, X: np.ndarray, y: np.ndarray, feature_names: list[str]) -> dict:
    """Train models and evaluate on test set."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED
    )

    results = {}

    # --- 1. Median Baseline ---
    median_pred = np.full_like(y_test, np.median(y_train))
    results["Median Baseline"] = _compute_metrics(y_test, median_pred)

    # --- 2. Random Forest ---
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    results["RandomForest"] = _compute_metrics(y_test, rf_pred)

    # Feature importances
    importances = dict(zip(feature_names, rf.feature_importances_))
    top_features = sorted(importances.items(), key=lambda x: -x[1])[:5]
    results["RandomForest"]["top_features"] = [
        {"feature": f, "importance": round(float(imp), 4)}
        for f, imp in top_features
    ]

    # Prediction intervals via quantile estimation (using individual tree predictions)
    tree_preds = np.array([tree.predict(X_test) for tree in rf.estimators_])
    lower = np.percentile(tree_preds, 10, axis=0)
    upper = np.percentile(tree_preds, 90, axis=0)
    coverage = np.mean((y_test >= lower) & (y_test <= upper))
    results["RandomForest"]["interval_coverage_80pct"] = round(float(coverage), 4)

    # --- 3. HistGradientBoosting (XGBoost-like) ---
    hgb = HistGradientBoostingRegressor(
        max_iter=300,
        max_depth=8,
        learning_rate=0.05,
        min_samples_leaf=10,
        random_state=RANDOM_SEED,
    )
    hgb.fit(X_train, y_train)
    hgb_pred = hgb.predict(X_test)
    results["HistGradientBoosting"] = _compute_metrics(y_test, hgb_pred)

    return results


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute regression metrics."""
    return {
        "MAE": round(float(mean_absolute_error(y_true, y_pred)), 3),
        "MedAE": round(float(median_absolute_error(y_true, y_pred)), 3),
        "RMSE": round(float(root_mean_squared_error(y_true, y_pred)), 3),
    }


def main():
    print("=" * 70)
    print("  APPROVAL-TIME PREDICTION -- MODEL COMPARISON")
    print("  ALL MODELS TRAINED ON SYNTHETIC DATA")
    print("=" * 70)

    df = load_data()
    X, encoders, feature_names = prepare_features(df)

    all_results = {}

    for target in TARGETS:
        y = df[target].values
        print(f"\n{'-' * 70}")
        print(f"  Target: {target}")
        print(f"  Train/Test: {int(len(y)*0.8)} / {int(len(y)*0.2)}")
        print(f"  Target stats: mean={y.mean():.2f}, median={np.median(y):.2f}, "
              f"std={y.std():.2f}, min={y.min():.2f}, max={y.max():.2f}")
        print(f"{'-' * 70}")

        results = train_and_evaluate(target, X, y, feature_names)
        all_results[target] = results

        # Print comparison table
        print(f"\n  {'Model':<25} {'MAE':>8} {'MedAE':>8} {'RMSE':>8}")
        print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*8}")
        for model, metrics in results.items():
            print(f"  {model:<25} {metrics['MAE']:>8.3f} {metrics['MedAE']:>8.3f} {metrics['RMSE']:>8.3f}")

        # Print feature importances for RF
        if "top_features" in results.get("RandomForest", {}):
            print(f"\n  Top 5 Features (RandomForest):")
            for feat in results["RandomForest"]["top_features"]:
                print(f"    {feat['feature']:<25} {feat['importance']:.4f}")

        # Print interval coverage for RF
        if "interval_coverage_80pct" in results.get("RandomForest", {}):
            cov = results["RandomForest"]["interval_coverage_80pct"]
            print(f"\n  80% Prediction Interval Coverage: {cov*100:.1f}%")

    # Save results
    results_path = OUTPUT_DIR / "model_comparison.json"
    with open(str(results_path), "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)

    print(f"\n{'=' * 70}")
    print(f"  Results saved to: {results_path}")
    print(f"  NOTE: All metrics are from SYNTHETIC data.")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
