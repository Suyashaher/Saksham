"""Trust Score Calculator — transparent, rule-based scoring (0-100).

Every score includes human-readable reasons per factor.
Scores NEVER modify instrument state — they are read-only snapshots.

Bands (per design doc B.4):
  80-100  HIGH    (low risk — routine approval)
  50-79   MEDIUM  (needs review)
  0-49    LOW     (high priority — detailed scrutiny)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import TrustBand
from app.db.models.instrument import Instrument
from app.db.models.ai_models import TrustScoreSnapshot
from app.ai.trust.factors import ALL_FACTORS, FactorResult
from app.ai.trust.weights import WeightStore

logger = logging.getLogger(__name__)

MODEL_VERSION = "v1.0-rule-based"


@dataclass
class TrustScoreResult:
    """Full trust score result with breakdown."""

    score: int  # 0-100
    band: TrustBand
    factors: list[FactorResult]
    weights_version: int
    model_version: str = MODEL_VERSION
    data_source: str = "rule_based"


def score_to_band(score: int) -> TrustBand:
    """Map numeric score to trust band."""
    if score >= 80:
        return TrustBand.HIGH
    elif score >= 50:
        return TrustBand.MEDIUM
    else:
        return TrustBand.LOW


class TrustScoreCalculator:
    """Computes transparent trust scores for instruments."""

    async def compute(
        self,
        instrument: Instrument,
        session: AsyncSession,
    ) -> TrustScoreResult:
        """Compute the trust score for an instrument.

        Returns a full result with per-factor breakdown and reasons.
        """
        # Load active weights
        weights, weights_version = await WeightStore.get_active_weights(session)

        # Compute each factor
        factor_results: list[FactorResult] = []
        for factor_fn in ALL_FACTORS:
            try:
                result = await factor_fn(instrument, session)
                # Assign weight and compute contribution
                factor_weight = weights.get(result.name, 0.0)
                result.weight = factor_weight
                result.contribution = round(result.normalized * factor_weight, 2)
                factor_results.append(result)
            except Exception as e:
                logger.error("Factor %s failed: %s", factor_fn.__name__, e)
                # Failed factor gets neutral score
                factor_results.append(FactorResult(
                    name=factor_fn.__name__.replace("compute_", ""),
                    raw_value="error",
                    normalized=0.5,
                    reason=f"Factor computation failed: {e}",
                    weight=weights.get(factor_fn.__name__.replace("compute_", ""), 0.0),
                    contribution=0.0,
                ))

        # Sum contributions
        total_score = round(sum(f.contribution for f in factor_results))
        total_score = max(0, min(100, total_score))  # clamp to 0-100

        band = score_to_band(total_score)

        return TrustScoreResult(
            score=total_score,
            band=band,
            factors=factor_results,
            weights_version=weights_version,
        )

    async def compute_and_store(
        self,
        instrument: Instrument,
        session: AsyncSession,
    ) -> TrustScoreResult:
        """Compute, snapshot to DB, and return the trust score."""
        result = await self.compute(instrument, session)

        snapshot = TrustScoreSnapshot(
            instrument_id=instrument.id,
            score=result.score,
            band=result.band.value,
            factor_breakdown={
                f.name: {
                    "normalized": f.normalized,
                    "weight": f.weight,
                    "contribution": f.contribution,
                    "reason": f.reason,
                }
                for f in result.factors
            },
            weights_version=result.weights_version,
            model_version=result.model_version,
        )
        session.add(snapshot)

        return result
