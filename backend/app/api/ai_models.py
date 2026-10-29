"""AI Models registry API router — admin model management."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_session, require_roles
from app.db.enums import UserRole
from app.db.models.ai_models import AIModel
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1/ai", tags=["AI Models"])


class AIModelResponse(BaseModel):
    id: str
    model_name: str
    version: str
    stage: str
    data_source: str
    metrics: dict | None
    trained_at: str | None
    registered_at: str


@router.get("/models", response_model=list[AIModelResponse])
async def list_models(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.ADMIN)),
):
    """List all registered AI models (Admin only)."""
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise HTTPException(status_code=503, detail="AI features are disabled")

    result = await session.execute(
        select(AIModel).order_by(AIModel.registered_at.desc())
    )
    models = list(result.scalars().all())

    return [
        AIModelResponse(
            id=str(m.id),
            model_name=m.model_name,
            version=m.version,
            stage=m.stage,
            data_source=m.data_source,
            metrics=m.metrics,
            trained_at=m.trained_at.isoformat() if m.trained_at else None,
            registered_at=m.registered_at.isoformat(),
        )
        for m in models
    ]


@router.post("/models/{model_id}/promote")
async def promote_model(
    model_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.ADMIN)),
):
    """Promote a model to production (Admin only).

    Archives the current production model and promotes the specified one.
    """
    settings = get_settings()
    if not settings.AI_ENABLED:
        raise HTTPException(status_code=503, detail="AI features are disabled")

    result = await session.execute(
        select(AIModel).where(AIModel.id == model_id)
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    # Archive current production model of same name
    await session.execute(
        update(AIModel)
        .where(
            AIModel.model_name == model.model_name,
            AIModel.stage == "production",
        )
        .values(stage="archived")
    )

    # Promote
    model.stage = "production"
    model.approved_by = user.id

    await AuditService.record(
        session,
        actor_id=user.id,
        action="ai_model_promoted",
        entity_type="ai_model",
        entity_id=model.id,
        payload={
            "model_name": model.model_name,
            "version": model.version,
            "data_source": model.data_source,
        },
    )

    await session.commit()

    return {
        "status": "promoted",
        "model_name": model.model_name,
        "version": model.version,
        "stage": "production",
    }
