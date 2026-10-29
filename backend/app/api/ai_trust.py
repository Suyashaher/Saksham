"""Trust Score API router."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_session, require_roles
from app.db.enums import UserRole
from app.db.models.instrument import Instrument
from app.db.models.ai_models import TrustScoreSnapshot
from app.ai.trust.calculator import TrustScoreCalculator
from app.ai.trust.weights import WeightStore
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1", tags=["AI Trust Score"])


# ── Response schemas ─────────────────────────────────────────────────────────


class FactorResponse(BaseModel):
    name: str
    normalized: float
    weight: float
    contribution: float
    reason: str


class TrustScoreResponse(BaseModel):
    score: int
    band: str
    factors: list[FactorResponse]
    weights_version: int
    model_version: str
    data_source: str


class WeightResponse(BaseModel):
    version: int
    is_active: bool
    effective_from: str | None
    effective_to: str | None
    factors: dict[str, float]


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/instruments/{instrument_id}/trust-score", response_model=TrustScoreResponse)
async def get_trust_score(
    instrument_id: uuid.UUID,
    recompute: bool = False,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN)),
):
    """Get the trust score for an instrument.

    Returns the latest snapshot, or recomputes if `recompute=true` or no
    snapshot exists. Score includes per-factor breakdown with human-readable
    reasons.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_TRUST_ENABLED:
        raise HTTPException(status_code=503, detail="Trust Score feature is disabled")

    # Load instrument
    result = await session.execute(
        select(Instrument).where(Instrument.id == instrument_id)
    )
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    if not recompute:
        # Try to get latest snapshot
        snap_result = await session.execute(
            select(TrustScoreSnapshot)
            .where(TrustScoreSnapshot.instrument_id == instrument_id)
            .order_by(TrustScoreSnapshot.computed_at.desc())
            .limit(1)
        )
        snapshot = snap_result.scalar_one_or_none()
        if snapshot:
            factors = []
            for fname, fdata in snapshot.factor_breakdown.items():
                factors.append(FactorResponse(
                    name=fname,
                    normalized=fdata.get("normalized", 0),
                    weight=fdata.get("weight", 0),
                    contribution=fdata.get("contribution", 0),
                    reason=fdata.get("reason", ""),
                ))
            return TrustScoreResponse(
                score=snapshot.score,
                band=snapshot.band,
                factors=factors,
                weights_version=snapshot.weights_version,
                model_version=snapshot.model_version,
                data_source="rule_based",
            )

    # Recompute
    calculator = TrustScoreCalculator()
    score_result = await calculator.compute_and_store(instrument, session)

    await AuditService.record(
        session,
        actor_id=user.id,
        action="trust_score_computed",
        entity_type="instrument",
        entity_id=instrument.id,
        payload={
            "score": score_result.score,
            "band": score_result.band.value,
            "weights_version": score_result.weights_version,
        },
    )

    await session.commit()

    return TrustScoreResponse(
        score=score_result.score,
        band=score_result.band.value,
        factors=[
            FactorResponse(
                name=f.name,
                normalized=f.normalized,
                weight=f.weight,
                contribution=f.contribution,
                reason=f.reason,
            )
            for f in score_result.factors
        ],
        weights_version=score_result.weights_version,
        model_version=score_result.model_version,
        data_source="rule_based",
    )


@router.get("/ai/weights", response_model=list[WeightResponse])
async def list_trust_weights(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.ADMIN)),
):
    """List all trust score weight versions (Admin only)."""
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_TRUST_ENABLED:
        raise HTTPException(status_code=503, detail="Trust Score feature is disabled")

    versions = await WeightStore.list_versions(session)
    return [WeightResponse(**v) for v in versions]


@router.put("/ai/weights")
async def update_trust_weights(
    weights: dict[str, float],
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.ADMIN)),
):
    """Create a new trust score weight version (Admin only).

    The new version becomes active immediately. Previous version is archived.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_TRUST_ENABLED:
        raise HTTPException(status_code=503, detail="Trust Score feature is disabled")

    # Validate weights sum to ~100
    total = sum(weights.values())
    if abs(total - 100) > 1:
        raise HTTPException(
            status_code=400,
            detail=f"Weights must sum to 100 (got {total})",
        )

    new_version = await WeightStore.create_new_version(
        session, weights, approved_by=user.id
    )

    await AuditService.record(
        session,
        actor_id=user.id,
        action="trust_weights_updated",
        entity_type="trust_score_weights",
        entity_id=user.id,
        payload={"new_version": new_version, "weights": weights},
    )

    await session.commit()

    return {"version": new_version, "weights": weights, "status": "active"}
