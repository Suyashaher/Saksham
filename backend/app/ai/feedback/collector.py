"""Feedback collector — collects officer corrections on AI outputs.

Anti-abuse safeguards:
  - Rate limit: max FEEDBACK_MAX_PER_DAY labels per officer per day
  - Input snapshots go through LlmPayloadGuard (no sensitive data)
  - Unique constraint: 1 feedback per user per output (dedup)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.common.payload_guard import sanitize_for_log
from app.core import clock
from app.core.config import get_settings
from app.db.enums import OfficerVerdict
from app.db.models.feedback import FeedbackLabel

logger = logging.getLogger(__name__)


class FeedbackRateLimitError(Exception):
    """Raised when an officer exceeds the daily feedback limit."""
    pass


class FeedbackDuplicateError(Exception):
    """Raised when duplicate feedback is submitted."""
    pass


class FeedbackCollector:
    """Collects and validates officer feedback on AI outputs."""

    @staticmethod
    async def submit(
        session: AsyncSession,
        *,
        ai_feature: str,
        entity_id: uuid.UUID,
        ai_output: dict | None,
        officer_verdict: OfficerVerdict,
        labelled_by: uuid.UUID,
        model_version: str | None = None,
        input_snapshot: dict | None = None,
        correction: dict | None = None,
        verdict_detail: str | None = None,
        feedback_source: str = "manual",
    ) -> FeedbackLabel:
        """Submit a feedback label with rate limiting and dedup.

        Raises:
            FeedbackRateLimitError: if daily limit exceeded
            FeedbackDuplicateError: if duplicate feedback
        """
        settings = get_settings()

        # Rate limit check
        now = datetime.now(timezone.utc)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        count_result = await session.execute(
            select(func.count()).select_from(FeedbackLabel).where(
                FeedbackLabel.labelled_by == labelled_by,
                FeedbackLabel.created_at >= day_start,
            )
        )
        day_count = count_result.scalar_one()

        if day_count >= settings.FEEDBACK_MAX_PER_DAY:
            raise FeedbackRateLimitError(
                f"Daily feedback limit reached ({settings.FEEDBACK_MAX_PER_DAY}/day)"
            )

        # Duplicate check — 1 feedback per user per feature per entity
        dup_result = await session.execute(
            select(FeedbackLabel.id).where(
                FeedbackLabel.ai_feature == ai_feature,
                FeedbackLabel.entity_id == entity_id,
                FeedbackLabel.labelled_by == labelled_by,
            ).limit(1)
        )
        if dup_result.scalar_one_or_none() is not None:
            raise FeedbackDuplicateError(
                "Feedback already submitted for this AI output"
            )

        # Sanitize input snapshot (remove any sensitive data)
        safe_snapshot = None
        if input_snapshot:
            safe_snapshot = sanitize_for_log(input_snapshot)

        label = FeedbackLabel(
            ai_feature=ai_feature,
            entity_id=entity_id,
            ai_output=ai_output,
            officer_verdict=officer_verdict,
            labelled_by=labelled_by,
            model_version=model_version,
            input_snapshot=safe_snapshot,
            correction=correction,
            verdict_detail=verdict_detail,
            feedback_source=feedback_source,
        )
        session.add(label)
        return label

    @staticmethod
    async def auto_label_outcome(
        session: AsyncSession,
        *,
        ai_feature: str,
        entity_id: uuid.UUID,
        ai_output: dict,
        actual_outcome: dict,
        model_version: str | None = None,
    ) -> FeedbackLabel | None:
        """Create an automatic label from an observed outcome.

        For example, when an instrument is verified, compare predicted
        turnaround with actual turnaround.
        """
        # Determine verdict based on outcome
        predicted = ai_output.get("predicted_days")
        actual = actual_outcome.get("actual_days")

        if predicted is not None and actual is not None:
            error = abs(float(predicted) - float(actual))
            verdict = (
                OfficerVerdict.CORRECT if error <= 2.0
                else OfficerVerdict.INCORRECT
            )
            detail = f"error={error:.1f}d"
        else:
            verdict = OfficerVerdict.CORRECT
            detail = "auto-labeled"

        settings = get_settings()
        system_user_id = uuid.UUID(settings.SYSTEM_USER_ID)

        label = FeedbackLabel(
            ai_feature=ai_feature,
            entity_id=entity_id,
            ai_output=ai_output,
            officer_verdict=verdict,
            labelled_by=system_user_id,
            model_version=model_version,
            input_snapshot=actual_outcome,
            verdict_detail=detail,
            feedback_source="outcome",
        )
        session.add(label)
        return label
