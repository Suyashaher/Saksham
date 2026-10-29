"""Approval-time predictor — point estimates with confidence intervals.

Graceful degradation:
  - Trained model → ML prediction with RF quantile intervals
  - No model → heuristic median with `is_heuristic: true`

Every prediction includes model_version and data_source.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.instrument import Instrument
from app.db.models.ai_models import PredictionSnapshot
from app.ai.prediction.features import extract_features
from app.ai.prediction.model_loader import ModelLoader

logger = logging.getLogger(__name__)

# Heuristic defaults when no model is available
HEURISTIC_VERIFICATION_DAYS = 7.0
HEURISTIC_RELEASE_DAYS = 5.0

# Feature order for the model (must match training)
NUMERIC_FEATURES = [
    "amount", "tenure_months", "n_documents", "doc_completeness",
    "n_alerts", "submission_dow", "officer_workload",
]

CATEGORICAL_FEATURES = [
    "amount_bucket", "bank", "state", "verification_method",
]


@dataclass
class PredictionResult:
    """Single prediction result."""

    target_type: str  # "verification" or "release"
    predicted_days: float
    interval_low: float | None
    interval_high: float | None
    confidence: float | None
    is_heuristic: bool
    model_version: str
    data_source: str
    reasons: list[str]


@dataclass
class FullPrediction:
    """Combined prediction for both targets."""

    verification: PredictionResult | None
    release: PredictionResult | None
    features_snapshot: dict


class ApprovalTimePredictor:
    """Predicts verification and release turnaround times."""

    def __init__(self) -> None:
        self._loader = ModelLoader()

    async def predict(
        self, instrument: Instrument, session: AsyncSession
    ) -> FullPrediction:
        """Generate predictions for an instrument."""
        features = await extract_features(instrument, session)

        verification = self._predict_target(
            "verification", "time_prediction_verification", features
        )
        release = self._predict_target(
            "release", "time_prediction_release", features
        )

        return FullPrediction(
            verification=verification,
            release=release,
            features_snapshot=features,
        )

    def _predict_target(
        self, target_type: str, model_name: str, features: dict
    ) -> PredictionResult:
        """Predict for a single target (verification or release)."""
        model = self._loader.load_model(model_name)
        metadata = self._loader.get_model_metadata(model_name)

        if model is None:
            return self._heuristic_prediction(target_type, features)

        try:
            # Prepare feature vector
            X = self._prepare_features(features)
            prediction = float(model.predict(X)[0])

            # Try to get prediction intervals from RF
            interval_low, interval_high = self._get_intervals(model, X)

            reasons = self._generate_reasons(features, prediction, target_type)

            return PredictionResult(
                target_type=target_type,
                predicted_days=round(prediction, 1),
                interval_low=round(interval_low, 1) if interval_low else None,
                interval_high=round(interval_high, 1) if interval_high else None,
                confidence=0.80 if interval_low else None,
                is_heuristic=False,
                model_version=metadata.get("version", "unknown"),
                data_source=metadata.get("data_source", "synthetic"),
                reasons=reasons,
            )
        except Exception as e:
            logger.error("Model prediction failed for %s: %s", model_name, e)
            return self._heuristic_prediction(target_type, features)

    def _heuristic_prediction(
        self, target_type: str, features: dict
    ) -> PredictionResult:
        """Fallback heuristic when no model is available."""
        base = (
            HEURISTIC_VERIFICATION_DAYS
            if target_type == "verification"
            else HEURISTIC_RELEASE_DAYS
        )

        # Simple adjustments based on features
        reasons = [
            f"Using heuristic estimate (no trained model available)",
            f"Base estimate: {base} days for {target_type}",
        ]

        # Adjust for document completeness
        completeness = features.get("doc_completeness", 1.0)
        if completeness < 1.0:
            base *= 1.3
            reasons.append("Incomplete documents may add delay (+30%)")

        # Adjust for alert count
        n_alerts = features.get("n_alerts", 0)
        if n_alerts > 0:
            base *= (1 + 0.15 * n_alerts)
            reasons.append(f"{n_alerts} alert(s) may add processing time")

        return PredictionResult(
            target_type=target_type,
            predicted_days=round(base, 1),
            interval_low=round(base * 0.6, 1),
            interval_high=round(base * 1.5, 1),
            confidence=0.60,
            is_heuristic=True,
            model_version="heuristic-v1",
            data_source="n/a",
            reasons=reasons,
        )

    def _prepare_features(self, features: dict) -> np.ndarray:
        """Prepare feature vector for sklearn model."""
        values = []
        for f in NUMERIC_FEATURES:
            val = features.get(f, 0)
            values.append(float(val) if val is not None else 0.0)

        # One-hot encode categoricals (simplified — using hash encoding)
        for f in CATEGORICAL_FEATURES:
            val = str(features.get(f, "unknown"))
            values.append(float(hash(val) % 1000) / 1000.0)

        return np.array([values])

    def _get_intervals(
        self, model: object, X: np.ndarray
    ) -> tuple[float | None, float | None]:
        """Try to get prediction intervals from RF per-tree predictions."""
        try:
            if hasattr(model, "estimators_"):
                # RandomForest — get per-tree predictions
                tree_preds = np.array(
                    [tree.predict(X)[0] for tree in model.estimators_]
                )
                low = float(np.percentile(tree_preds, 10))
                high = float(np.percentile(tree_preds, 90))
                return max(0, low), high
        except Exception:
            pass
        return None, None

    def _generate_reasons(
        self, features: dict, prediction: float, target_type: str
    ) -> list[str]:
        """Generate human-readable reasons for the prediction."""
        reasons = []
        reasons.append(
            f"Predicted {target_type} turnaround: {prediction:.1f} days"
        )

        if features.get("doc_completeness", 1.0) < 1.0:
            reasons.append("Incomplete documentation may increase processing time")

        if features.get("n_alerts", 0) > 0:
            reasons.append(
                f"{features['n_alerts']} alert(s) on this instrument"
            )

        if features.get("is_renewal"):
            reasons.append("Renewal instruments typically process faster")

        workload = features.get("officer_workload", 0)
        if workload > 10:
            reasons.append(f"Assigned officer has high workload ({workload} active cases)")

        return reasons

    async def predict_and_store(
        self, instrument: Instrument, session: AsyncSession
    ) -> FullPrediction:
        """Predict and store snapshots to DB."""
        result = await self.predict(instrument, session)

        for pred in [result.verification, result.release]:
            if pred is not None:
                snapshot = PredictionSnapshot(
                    instrument_id=instrument.id,
                    target_type=pred.target_type,
                    predicted_days=pred.predicted_days,
                    interval_low=pred.interval_low,
                    interval_high=pred.interval_high,
                    confidence=pred.confidence,
                    is_heuristic=pred.is_heuristic,
                    model_version=pred.model_version,
                    data_source=pred.data_source,
                    features_snapshot=result.features_snapshot,
                )
                session.add(snapshot)

        return result
