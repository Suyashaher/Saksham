"""Prediction API router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_session, require_roles
from app.db.enums import UserRole
from app.db.models.instrument import Instrument
from app.ai.prediction.predictor import ApprovalTimePredictor
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1", tags=["AI Prediction"])


class PredictionTargetResponse(BaseModel):
    predicted_days: float
    interval_low: float | None
    interval_high: float | None
    confidence: float | None
    is_heuristic: bool
    model_version: str
    data_source: str
    reasons: list[str]


class PredictionResponse(BaseModel):
    verification: PredictionTargetResponse | None
    release: PredictionTargetResponse | None


@router.get(
    "/instruments/{instrument_id}/predicted-time",
    response_model=PredictionResponse,
)
async def get_predicted_time(
    instrument_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(
        UserRole.VERIFYING_OFFICER,
        UserRole.APPROVING_AUTHORITY,
        UserRole.ADMIN,
        UserRole.INSTITUTION,
    )),
):
    """Get approval-time prediction for an instrument.

    Returns point estimates with 80% confidence intervals for both
    verification and release turnaround. If no ML model is available,
    falls back to heuristic estimates marked with `is_heuristic: true`.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_PREDICTION_ENABLED:
        raise HTTPException(status_code=503, detail="Prediction feature is disabled")

    result = await session.execute(
        select(Instrument).where(Instrument.id == instrument_id)
    )
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    predictor = ApprovalTimePredictor()
    prediction = await predictor.predict_and_store(instrument, session)

    await AuditService.record(
        session,
        actor_id=user.id,
        action="prediction_requested",
        entity_type="instrument",
        entity_id=instrument.id,
        payload={
            "verification_days": prediction.verification.predicted_days if prediction.verification else None,
            "release_days": prediction.release.predicted_days if prediction.release else None,
            "is_heuristic": prediction.verification.is_heuristic if prediction.verification else True,
        },
    )

    await session.commit()

    def _to_response(pred) -> PredictionTargetResponse | None:
        if pred is None:
            return None
        return PredictionTargetResponse(
            predicted_days=pred.predicted_days,
            interval_low=pred.interval_low,
            interval_high=pred.interval_high,
            confidence=pred.confidence,
            is_heuristic=pred.is_heuristic,
            model_version=pred.model_version,
            data_source=pred.data_source,
            reasons=pred.reasons,
        )

    return PredictionResponse(
        verification=_to_response(prediction.verification),
        release=_to_response(prediction.release),
    )
