"""Feedback API router — submit labels and view stats."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_session, require_roles
from app.db.enums import OfficerVerdict, UserRole
from app.ai.feedback.collector import (
    FeedbackCollector,
    FeedbackDuplicateError,
    FeedbackRateLimitError,
)
from app.ai.feedback.metrics import compute_all_rewards
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1/ai", tags=["AI Feedback"])


class FeedbackSubmitRequest(BaseModel):
    ai_feature: str
    entity_id: uuid.UUID
    ai_output: dict | None = None
    officer_verdict: str  # "CORRECT" or "INCORRECT"
    model_version: str | None = None
    correction: dict | None = None
    verdict_detail: str | None = None


class FeedbackSubmitResponse(BaseModel):
    id: str
    ai_feature: str
    officer_verdict: str
    status: str


class RewardMetric(BaseModel):
    ai_feature: str
    window_days: int
    reward: float
    correct_count: int
    incorrect_count: int
    total_count: int


@router.post("/feedback", response_model=FeedbackSubmitResponse)
async def submit_feedback(
    body: FeedbackSubmitRequest,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(
        UserRole.INSTITUTION, UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN
    )),
):
    """Submit feedback (correction/verdict) on an AI output.

    Rate limited to FEEDBACK_MAX_PER_DAY per officer per day.
    Duplicate submissions for the same entity are rejected.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_FEEDBACK_ENABLED:
        raise HTTPException(status_code=503, detail="Feedback feature is disabled")

    try:
        verdict = OfficerVerdict(body.officer_verdict)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verdict: {body.officer_verdict}. Must be CORRECT or INCORRECT",
        )

    try:
        label = await FeedbackCollector.submit(
            session,
            ai_feature=body.ai_feature,
            entity_id=body.entity_id,
            ai_output=body.ai_output,
            officer_verdict=verdict,
            labelled_by=user.id,
            model_version=body.model_version,
            correction=body.correction,
            verdict_detail=body.verdict_detail,
        )
    except FeedbackRateLimitError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except FeedbackDuplicateError as e:
        raise HTTPException(status_code=409, detail=str(e))

    await AuditService.record(
        session,
        actor_id=user.id,
        action="ai_feedback_submitted",
        entity_type="feedback",
        entity_id=label.id,
        payload={
            "ai_feature": body.ai_feature,
            "verdict": body.officer_verdict,
        },
    )

    await session.commit()

    return FeedbackSubmitResponse(
        id=str(label.id),
        ai_feature=body.ai_feature,
        officer_verdict=body.officer_verdict,
        status="recorded",
    )


@router.get("/feedback/stats", response_model=list[RewardMetric])
async def feedback_stats(
    window_days: int = 30,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.ADMIN)),
):
    """Get rolling reward metrics for all AI features (Admin only).

    Shows accuracy trend over the specified window (default 30 days).
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_FEEDBACK_ENABLED:
        raise HTTPException(status_code=503, detail="Feedback feature is disabled")

    metrics = await compute_all_rewards(session, window_days)
    return [RewardMetric(**m) for m in metrics]
