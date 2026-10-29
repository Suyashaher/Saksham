"""Admin router for AlertRule management."""

from __future__ import annotations

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.db.enums import UserRole
from app.db.models.alert_rule import AlertRule
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.alert_rule import AlertRuleCreate, AlertRuleRead, AlertRuleUpdate

router = APIRouter(prefix="/alert-rules", tags=["Alert Rules"])


@router.get("", response_model=list[AlertRuleRead])
async def list_alert_rules(
    is_active: bool | None = Query(None, description="Filter by active status"),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> list[AlertRule]:
    """List all alert rules (ADMIN only)."""
    stmt = select(AlertRule).order_by(AlertRule.created_at.desc())
    if is_active is not None:
        stmt = stmt.where(AlertRule.is_active == is_active)
    res = await session.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=AlertRuleRead, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    payload: AlertRuleCreate,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AlertRule:
    """Create a new alert rule (ADMIN only)."""
    # Check duplicate name
    existing = await session.execute(
        select(AlertRule).where(AlertRule.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An alert rule named '{payload.name}' already exists",
        )

    rule = AlertRule(**payload.model_dump())
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=AlertRuleRead)
async def get_alert_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AlertRule:
    """Get alert rule by ID (ADMIN only)."""
    res = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )
    return rule


@router.patch("/{rule_id}", response_model=AlertRuleRead)
async def update_alert_rule(
    rule_id: uuid.UUID,
    payload: AlertRuleUpdate,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AlertRule:
    """Update an existing alert rule (ADMIN only)."""
    res = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != rule.name:
        existing = await session.execute(
            select(AlertRule).where(AlertRule.name == update_data["name"])
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An alert rule named '{update_data['name']}' already exists",
            )

    for field, val in update_data.items():
        setattr(rule, field, val)

    await session.commit()
    await session.refresh(rule)
    return rule


@router.delete("/{rule_id}", response_model=AlertRuleRead)
async def delete_alert_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> AlertRule:
    """Soft-delete an alert rule by setting is_active=False (ADMIN only)."""
    res = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )

    rule.is_active = False
    await session.commit()
    await session.refresh(rule)
    return rule
