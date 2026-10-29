"""AI Celery tasks — nightly trust recompute, weekly retrain, async OCR."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.db.enums import FDRStatus
from app.db.models.instrument import Instrument
from app.db.session import async_session_factory
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


# ── Nightly Trust Score Recompute ────────────────────────────────────────────


async def _async_nightly_trust_recompute():
    """Recompute trust scores for all active/expiring instruments."""
    from app.ai.trust.calculator import TrustScoreCalculator

    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_TRUST_ENABLED:
        logger.info("Trust score recompute skipped — feature disabled")
        return {"recomputed": 0, "skipped": True}

    calculator = TrustScoreCalculator()
    count = 0

    async with async_session_factory() as session:
        result = await session.execute(
            select(Instrument).where(
                Instrument.status.in_([
                    FDRStatus.ACTIVE,
                    FDRStatus.EXPIRING,
                    FDRStatus.SUBMITTED,
                    FDRStatus.UNDER_SCRUTINY,
                ])
            )
        )
        instruments = list(result.scalars().all())

        for instrument in instruments:
            try:
                await calculator.compute_and_store(instrument, session)
                count += 1
            except Exception as e:
                logger.error(
                    "Trust score recompute failed for %s: %s",
                    instrument.id, e,
                )

        await session.commit()

    logger.info("Nightly trust recompute complete: %d instruments", count)
    return {"recomputed": count}


@celery_app.task(name="workers.ai_tasks.nightly_trust_recompute")
def nightly_trust_recompute():
    """Celery task: nightly trust score recompute."""
    logger.info("Starting nightly_trust_recompute")
    return asyncio.run(_async_nightly_trust_recompute())


# ── Weekly Prediction Retrain ────────────────────────────────────────────────


async def _async_weekly_retrain():
    """Retrain prediction models on accumulated data."""
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_PREDICTION_ENABLED:
        logger.info("Prediction retrain skipped — feature disabled")
        return {"retrained": False, "reason": "disabled"}

    # For now, log that retrain would happen
    # Full retraining pipeline will be triggered when enough real data exists
    logger.info(
        "Weekly retrain check — requires %d+ samples for training",
        settings.PREDICTION_MIN_SAMPLES,
    )

    return {"retrained": False, "reason": "not_enough_data"}


@celery_app.task(name="workers.ai_tasks.weekly_retrain_prediction")
def weekly_retrain_prediction():
    """Celery task: weekly prediction model retrain."""
    logger.info("Starting weekly_retrain_prediction")
    return asyncio.run(_async_weekly_retrain())
