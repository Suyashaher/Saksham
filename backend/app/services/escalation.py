"""Escalation service — manage alert acknowledgments, resolutions, and automatic level escalations."""

from __future__ import annotations

import datetime
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.db.enums import AlertChannel, AlertEscalationLevel, AlertStatus, UserRole
from app.db.models.alert import Alert
from app.db.models.alert_rule import AlertRule
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.services.audit_service import AuditService


async def acknowledge_alert(
    session: AsyncSession,
    alert_id: uuid.UUID,
    actor: User,
) -> Alert | None:
    """Acknowledge an alert, stopping further escalation."""
    stmt = (
        select(Alert)
        .where(Alert.id == alert_id)
        .options(selectinload(Alert.instrument))
    )
    res = await session.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        return None

    if alert.acknowledged_at is None:
        alert.acknowledged_at = clock.now()
        alert.acknowledged_by = actor.id
        await AuditService.record(
            session,
            actor_id=actor.id,
            action="alert_acknowledged",
            entity_type="alert",
            entity_id=alert.id,
            payload={
                "instrument_id": str(alert.instrument_id),
                "rule_name": alert.rule_name,
                "escalation_level": alert.escalation_level,
            },
        )
        await session.flush()
    return alert


async def resolve_alert(
    session: AsyncSession,
    alert_id: uuid.UUID,
    actor: User,
    reason: str,
) -> Alert | None:
    """Resolve an alert manually with a reason."""
    stmt = (
        select(Alert)
        .where(Alert.id == alert_id)
        .options(selectinload(Alert.instrument))
    )
    res = await session.execute(stmt)
    alert = res.scalar_one_or_none()
    if not alert:
        return None

    alert.resolved = True
    alert.resolved_at = clock.now()
    alert.resolved_reason = reason
    await AuditService.record(
        session,
        actor_id=actor.id,
        action="alert_resolved",
        entity_type="alert",
        entity_id=alert.id,
        payload={
            "instrument_id": str(alert.instrument_id),
            "reason": reason,
        },
    )
    await session.flush()
    return alert


async def auto_resolve_alerts(
    session: AsyncSession,
    instrument_id: uuid.UUID,
    reason: str,
) -> int:
    """Automatically resolve all open alerts for an instrument (e.g. on renewal/activation)."""
    stmt = (
        update(Alert)
        .where(
            Alert.instrument_id == instrument_id,
            Alert.resolved_at.is_(None),
            Alert.resolved == False,  # noqa: E712
        )
        .values(
            resolved=True,
            resolved_at=clock.now(),
            resolved_reason=reason,
        )
    )
    res = await session.execute(stmt)
    count = res.rowcount or 0
    if count > 0:
        await session.flush()
    return count


async def _find_recipient_for_level(
    session: AsyncSession,
    instrument: Instrument,
    level: int,
) -> User | None:
    """Find appropriate recipient user for an escalation level."""
    if level == AlertEscalationLevel.VERIFYING_OFFICER:
        if instrument.assigned_officer_id:
            res = await session.execute(
                select(User).where(User.id == instrument.assigned_officer_id, User.is_active == True)  # noqa: E712
            )
            u = res.scalar_one_or_none()
            if u:
                return u
        # Fallback to any active verifying officer
        res = await session.execute(
            select(User).where(User.role == UserRole.VERIFYING_OFFICER, User.is_active == True).limit(1)  # noqa: E712
        )
        return res.scalar_one_or_none()

    elif level == AlertEscalationLevel.APPROVING_AUTHORITY:
        res = await session.execute(
            select(User).where(User.role == UserRole.APPROVING_AUTHORITY, User.is_active == True).limit(1)  # noqa: E712
        )
        return res.scalar_one_or_none()

    return None


async def run_escalation(
    session: AsyncSession,
    as_of: datetime.date | None = None,
) -> dict[str, int]:
    """Check unacknowledged / unresolved alerts and escalate them if threshold is met."""
    today_date = as_of or clock.today()
    escalated_count = 0

    # Find candidate alerts: not resolved, not acknowledged, level < 2, has a rule with escalate_after_days
    stmt = (
        select(Alert)
        .join(AlertRule, Alert.rule_id == AlertRule.id)
        .join(Instrument, Alert.instrument_id == Instrument.id)
        .where(
            Alert.resolved_at.is_(None),
            Alert.resolved == False,  # noqa: E712
            Alert.acknowledged_at.is_(None),
            Alert.escalation_level < AlertEscalationLevel.APPROVING_AUTHORITY,
            AlertRule.escalate_after_days.is_not(None),
            AlertRule.is_active == True,  # noqa: E712
        )
        .options(
            selectinload(Alert.rule),
            selectinload(Alert.instrument),
        )
    )
    res = await session.execute(stmt)
    alerts = res.scalars().all()

    for alert in alerts:
        rule = alert.rule
        if not rule or not rule.escalate_after_days:
            continue

        base_date = alert.scheduled_for or alert.scheduled_at.date()
        days_passed = (today_date - base_date).days
        if days_passed < rule.escalate_after_days:
            continue

        next_level = alert.escalation_level + 1
        recipient = await _find_recipient_for_level(session, alert.instrument, next_level)
        if not recipient:
            continue

        # Check if child alert for this escalation level already exists (idempotency)
        existing_child_stmt = (
            select(Alert.id)
            .where(
                Alert.instrument_id == alert.instrument_id,
                Alert.rule_id == alert.rule_id,
                Alert.recipient_user_id == recipient.id,
                Alert.channel == alert.channel,
                Alert.scheduled_for == today_date,
                Alert.escalation_level == next_level,
            )
        )
        child_res = await session.execute(existing_child_stmt)
        if child_res.scalar_one_or_none() is not None:
            continue

        child_alert = Alert(
            instrument_id=alert.instrument_id,
            rule_id=alert.rule_id,
            rule_name=f"{rule.name} (Escalation L{next_level})",
            recipient_user_id=recipient.id,
            channel=alert.channel,
            scheduled_for=today_date,
            escalation_level=next_level,
            parent_alert_id=alert.id,
            status=AlertStatus.PENDING,
        )
        session.add(child_alert)
        escalated_count += 1

    if escalated_count > 0:
        await session.flush()

    return {"escalated_alerts": escalated_count}
