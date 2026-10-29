"""Router for Alert querying, acknowledgment, and resolution."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user, require_roles
from app.db.enums import AlertStatus, UserRole
from app.db.models.alert import Alert
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.alert import AlertRead, AlertResolveRequest
from app.services.escalation import acknowledge_alert, resolve_alert

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertRead])
async def list_alerts(
    status: AlertStatus | None = Query(None, description="Filter by alert status"),
    escalation_level: int | None = Query(None, ge=0, le=2, description="Filter by escalation level"),
    instrument_id: uuid.UUID | None = Query(None, description="Filter by instrument ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Alert]:
    """List alerts with filtering and institutional row-level scoping."""
    query = (
        select(Alert)
        .join(Instrument, Alert.instrument_id == Instrument.id)
        .order_by(Alert.scheduled_at.desc())
        .limit(limit)
        .offset(offset)
    )

    # Scoping: INSTITUTION users only see alerts for their own institution
    if current_user.role == UserRole.INSTITUTION:
        query = query.where(Instrument.institution_id == current_user.institution_id)

    if status is not None:
        query = query.where(Alert.status == status)
    if escalation_level is not None:
        query = query.where(Alert.escalation_level == escalation_level)
    if instrument_id is not None:
        query = query.where(Alert.instrument_id == instrument_id)

    res = await session.execute(query)
    return list(res.scalars().all())


@router.get("/{alert_id}", response_model=AlertRead)
async def get_alert(
    alert_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    """Get alert detail by ID with institutional scoping."""
    stmt = (
        select(Alert)
        .where(Alert.id == alert_id)
        .options(selectinload(Alert.instrument))
    )
    res = await session.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    if current_user.role == UserRole.INSTITUTION:
        if alert.instrument.institution_id != current_user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertRead)
async def acknowledge_alert_endpoint(
    alert_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    """Acknowledge an alert to halt automatic escalation."""
    # Scoping check
    stmt = (
        select(Alert)
        .where(Alert.id == alert_id)
        .options(selectinload(Alert.instrument))
    )
    res = await session.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    if current_user.role == UserRole.INSTITUTION:
        if alert.instrument.institution_id != current_user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    updated = await acknowledge_alert(session, alert_id, current_user)
    await session.commit()
    await session.refresh(updated)
    return updated


@router.post("/{alert_id}/resolve", response_model=AlertRead)
async def resolve_alert_endpoint(
    alert_id: uuid.UUID,
    payload: AlertResolveRequest,
    current_user: User = Depends(
        require_roles(UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN)
    ),
    session: AsyncSession = Depends(get_session),
) -> Alert:
    """Resolve an alert with an explanation note (Officers / Approvers / Admin only)."""
    updated = await resolve_alert(session, alert_id, current_user, payload.reason)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    await session.commit()
    await session.refresh(updated)
    return updated
