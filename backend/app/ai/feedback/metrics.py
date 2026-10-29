"""Rolling reward metrics per AI feature — tracks accuracy over time."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import OfficerVerdict
from app.db.models.feedback import FeedbackLabel


async def compute_rolling_reward(
    session: AsyncSession,
    ai_feature: str,
    window_days: int = 30,
) -> dict:
    """Compute 30-day rolling reward metric for an AI feature.

    reward = correct / (correct + incorrect)

    Returns dict with reward, correct_count, incorrect_count, total.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    result = await session.execute(
        select(
            func.count().filter(
                FeedbackLabel.officer_verdict == OfficerVerdict.CORRECT
            ).label("correct"),
            func.count().filter(
                FeedbackLabel.officer_verdict == OfficerVerdict.INCORRECT
            ).label("incorrect"),
            func.count().label("total"),
        )
        .select_from(FeedbackLabel)
        .where(
            FeedbackLabel.ai_feature == ai_feature,
            FeedbackLabel.created_at >= cutoff,
        )
    )
    row = result.one()
    correct = row.correct or 0
    incorrect = row.incorrect or 0
    total = row.total or 0

    reward = correct / max(correct + incorrect, 1)

    return {
        "ai_feature": ai_feature,
        "window_days": window_days,
        "reward": round(reward, 3),
        "correct_count": correct,
        "incorrect_count": incorrect,
        "total_count": total,
    }


async def compute_all_rewards(
    session: AsyncSession, window_days: int = 30
) -> list[dict]:
    """Compute rolling reward for all AI features."""
    features = [
        "ocr_autofill", "trust_score", "time_prediction",
        "nl_search", "cross_check", "letter_draft",
    ]
    results = []
    for feature in features:
        metric = await compute_rolling_reward(session, feature, window_days)
        results.append(metric)
    return results
