"""Monitoring service — automated daily scan for validity/maturity tracking and alert generation."""

from __future__ import annotations

import datetime
import logging
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.core.config import get_settings
from app.db.enums import (
    AlertChannel,
    AlertEscalationLevel,
    AlertRuleType,
    AlertStatus,
    FDRStatus,
    ReleaseRequestStatus,
    UserRole,
)
from app.db.models.alert import Alert
from app.db.models.alert_rule import AlertRule
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.user import User
from app.services.instrument_state import transition
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


async def get_system_user(session: AsyncSession) -> User:
    """Retrieve or create the system actor for automated jobs."""
    res = await session.execute(select(User).where(User.id == SYSTEM_USER_ID))
    user = res.scalar_one_or_none()
    if user is None:
        user = User(
            id=SYSTEM_USER_ID,
            email="system@fdr-portal.internal",
            full_name="FDR Portal System",
            hashed_password="!DISABLED!",
            role=UserRole.ADMIN,
            is_active=False,
        )
        session.add(user)
        await session.flush()
    return user


async def _get_recipients_for_role(
    session: AsyncSession,
    role: UserRole,
    instrument: Instrument,
) -> list[User]:
    """Resolve recipient users based on the rule role and instrument context."""
    if role == UserRole.INSTITUTION:
        res = await session.execute(
            select(User).where(
                User.institution_id == instrument.institution_id,
                User.is_active == True,  # noqa: E712
            )
        )
        return list(res.scalars().all())

    elif role == UserRole.VERIFYING_OFFICER:
        if instrument.assigned_officer_id:
            res = await session.execute(
                select(User).where(
                    User.id == instrument.assigned_officer_id,
                    User.is_active == True,  # noqa: E712
                )
            )
            officer = res.scalar_one_or_none()
            if officer:
                return [officer]
        # Fallback to any active verifying officer
        res = await session.execute(
            select(User).where(
                User.role == UserRole.VERIFYING_OFFICER,
                User.is_active == True,  # noqa: E712
            ).limit(1)
        )
        return list(res.scalars().all())

    elif role == UserRole.APPROVING_AUTHORITY:
        res = await session.execute(
            select(User).where(
                User.role == UserRole.APPROVING_AUTHORITY,
                User.is_active == True,  # noqa: E712
            ).limit(1)
        )
        return list(res.scalars().all())

    elif role == UserRole.ADMIN:
        res = await session.execute(
            select(User).where(
                User.role == UserRole.ADMIN,
                User.is_active == True,  # noqa: E712
            ).limit(1)
        )
        return list(res.scalars().all())

    return []


async def run_daily_scan(
    session: AsyncSession,
    as_of: datetime.date | None = None,
    dry_run: bool = False,
) -> dict:
    """Run automated daily validity/maturity tracking and alert generation.

    Deterministic and idempotent.
    - Transitions ACTIVE -> EXPIRING when maturity within max alert reminder window
    - Transitions ACTIVE/EXPIRING -> MATURED when maturity < as_of
    - Evaluates all active AlertRules
    - Emits alerts idempotently (via DB constraints and existence check)
    - If dry_run=True, rolls back all changes
    """
    scan_date = as_of or clock.today()
    system_actor = await get_system_user(session)

    # 1. Determine largest reminder window across active rules
    rules_res = await session.execute(
        select(AlertRule).where(AlertRule.is_active == True)  # noqa: E712
    )
    active_rules = list(rules_res.scalars().all())

    maturity_rules = [r for r in active_rules if r.rule_type == AlertRuleType.MATURITY_REMINDER]
    max_reminder_days = max([r.days for r in maturity_rules], default=90)

    transitioned_expiring = 0
    transitioned_matured = 0
    alerts_created = 0

    # 2. Check for EXPIRING transitions
    # ACTIVE instruments where maturity_date - scan_date <= max_reminder_days and maturity_date >= scan_date
    active_insts_res = await session.execute(
        select(Instrument).where(Instrument.status == FDRStatus.ACTIVE)
    )
    active_insts = list(active_insts_res.scalars().all())

    for inst in active_insts:
        days_to_maturity = (inst.maturity_date - scan_date).days
        if 0 <= days_to_maturity <= max_reminder_days:
            await transition(
                session,
                inst,
                FDRStatus.EXPIRING,
                system_actor,
                note=f"Automatic transition: {days_to_maturity} days to maturity (within {max_reminder_days}d window)",
            )
            inst.validity_status = "EXPIRING"
            transitioned_expiring += 1
        elif days_to_maturity < 0:
            # Already matured directly from ACTIVE
            await transition(
                session,
                inst,
                FDRStatus.MATURED,
                system_actor,
                note=f"Automatic transition: Instrument passed maturity date on {inst.maturity_date}",
            )
            inst.validity_status = "EXPIRED"
            transitioned_matured += 1
        else:
            inst.validity_status = "VALID"

    # 3. Check for MATURED transitions from EXPIRING instruments
    expiring_insts_res = await session.execute(
        select(Instrument).where(Instrument.status == FDRStatus.EXPIRING)
    )
    expiring_insts = list(expiring_insts_res.scalars().all())

    for inst in expiring_insts:
        if inst.maturity_date < scan_date:
            await transition(
                session,
                inst,
                FDRStatus.MATURED,
                system_actor,
                note=f"Automatic transition: Instrument matured on {inst.maturity_date}",
            )
            inst.validity_status = "EXPIRED"
            transitioned_matured += 1
        else:
            inst.validity_status = "EXPIRING"

    # 4. Evaluate Alert Rules
    for rule in active_rules:
        if rule.rule_type == AlertRuleType.MATURITY_REMINDER:
            # Eligible: ACTIVE or EXPIRING instruments where (maturity_date - scan_date).days <= rule.days and maturity_date >= scan_date
            stmt = select(Instrument).where(
                Instrument.status.in_([FDRStatus.ACTIVE, FDRStatus.EXPIRING]),
                Instrument.maturity_date >= scan_date,
            ).options(selectinload(Instrument.institution))
            res = await session.execute(stmt)
            candidates = res.scalars().all()

            for inst in candidates:
                days_left = (inst.maturity_date - scan_date).days
                if days_left <= rule.days:
                    recipients = await _get_recipients_for_role(session, rule.recipient_role, inst)
                    for user in recipients:
                        for channel in rule.channels:
                            # Check if alert already created for this rule and instrument
                            existing_stmt = select(Alert.id).where(
                                Alert.instrument_id == inst.id,
                                Alert.rule_id == rule.id,
                                Alert.recipient_user_id == user.id,
                                Alert.channel == channel,
                                Alert.escalation_level == 0,
                            )
                            existing_res = await session.execute(existing_stmt)
                            if existing_res.scalar_one_or_none() is not None:
                                continue

                            alert = Alert(
                                instrument_id=inst.id,
                                rule_id=rule.id,
                                rule_name=rule.name,
                                recipient_user_id=user.id,
                                channel=channel,
                                scheduled_for=scan_date,
                                escalation_level=0,
                                status=AlertStatus.PENDING,
                            )
                            session.add(alert)
                            await session.flush()
                            alerts_created += 1

                            if channel == AlertChannel.IN_APP.value:
                                await create_notification(
                                    session,
                                    user_id=user.id,
                                    title=f"Maturity Reminder: {rule.name}",
                                    body=f"Instrument {inst.reference_number} matures on {inst.maturity_date} ({days_left} days left).",
                                    alert_id=alert.id,
                                )

        elif rule.rule_type == AlertRuleType.OVERDUE_MATURED:
            # Eligible: MATURED instruments where (scan_date - maturity_date).days >= rule.days
            # Suppress if an open release request exists for that instrument
            open_rel_subq = select(1).where(
                ReleaseRequest.instrument_id == Instrument.id,
                ReleaseRequest.status.in_([ReleaseRequestStatus.PENDING, ReleaseRequestStatus.UNDER_REVIEW]),
            )
            stmt = select(Instrument).where(
                Instrument.status == FDRStatus.MATURED,
                Instrument.maturity_date < scan_date,
                ~open_rel_subq.exists(),
            ).options(selectinload(Instrument.institution))
            res = await session.execute(stmt)
            candidates = res.scalars().all()

            for inst in candidates:
                days_overdue = (scan_date - inst.maturity_date).days
                if days_overdue >= rule.days:
                    recipients = await _get_recipients_for_role(session, rule.recipient_role, inst)
                    for user in recipients:
                        for channel in rule.channels:
                            existing_stmt = select(Alert.id).where(
                                Alert.instrument_id == inst.id,
                                Alert.rule_id == rule.id,
                                Alert.recipient_user_id == user.id,
                                Alert.channel == channel,
                                Alert.escalation_level == 0,
                            )
                            existing_res = await session.execute(existing_stmt)
                            if existing_res.scalar_one_or_none() is not None:
                                continue

                            alert = Alert(
                                instrument_id=inst.id,
                                rule_id=rule.id,
                                rule_name=rule.name,
                                recipient_user_id=user.id,
                                channel=channel,
                                scheduled_for=scan_date,
                                escalation_level=0,
                                status=AlertStatus.PENDING,
                            )
                            session.add(alert)
                            await session.flush()
                            alerts_created += 1

                            if channel == AlertChannel.IN_APP.value:
                                await create_notification(
                                    session,
                                    user_id=user.id,
                                    title=f"Overdue Alert: {rule.name}",
                                    body=f"Instrument {inst.reference_number} matured on {inst.maturity_date} and is overdue by {days_overdue} days.",
                                    alert_id=alert.id,
                                )

        elif rule.rule_type == AlertRuleType.STALE_VERIFICATION:
            # Eligible: SUBMITTED or UNDER_SCRUTINY instruments for >= rule.days
            stmt = select(Instrument).where(
                Instrument.status.in_([FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY])
            ).options(selectinload(Instrument.institution))
            res = await session.execute(stmt)
            candidates = res.scalars().all()

            for inst in candidates:
                # Calculate age based on latest status history or created_at
                latest_history_stmt = (
                    select(InstrumentStatusHistory.changed_at)
                    .where(InstrumentStatusHistory.instrument_id == inst.id)
                    .order_by(InstrumentStatusHistory.changed_at.desc())
                    .limit(1)
                )
                h_res = await session.execute(latest_history_stmt)
                status_date = h_res.scalar_one_or_none()
                base_date = status_date.date() if status_date else inst.created_at.date()
                days_stale = (scan_date - base_date).days

                if days_stale >= rule.days:
                    recipients = await _get_recipients_for_role(session, rule.recipient_role, inst)
                    for user in recipients:
                        for channel in rule.channels:
                            existing_stmt = select(Alert.id).where(
                                Alert.instrument_id == inst.id,
                                Alert.rule_id == rule.id,
                                Alert.recipient_user_id == user.id,
                                Alert.channel == channel,
                                Alert.escalation_level == 0,
                            )
                            existing_res = await session.execute(existing_stmt)
                            if existing_res.scalar_one_or_none() is not None:
                                continue

                            alert = Alert(
                                instrument_id=inst.id,
                                rule_id=rule.id,
                                rule_name=rule.name,
                                recipient_user_id=user.id,
                                channel=channel,
                                scheduled_for=scan_date,
                                escalation_level=0,
                                status=AlertStatus.PENDING,
                            )
                            session.add(alert)
                            await session.flush()
                            alerts_created += 1

        elif rule.rule_type == AlertRuleType.DISCREPANCY_UNRESOLVED:
            # Eligible: DISCREPANCY instruments for >= rule.days
            stmt = select(Instrument).where(
                Instrument.status == FDRStatus.DISCREPANCY
            ).options(selectinload(Instrument.institution))
            res = await session.execute(stmt)
            candidates = res.scalars().all()

            for inst in candidates:
                latest_history_stmt = (
                    select(InstrumentStatusHistory.changed_at)
                    .where(
                        InstrumentStatusHistory.instrument_id == inst.id,
                        InstrumentStatusHistory.to_status == FDRStatus.DISCREPANCY,
                    )
                    .order_by(InstrumentStatusHistory.changed_at.desc())
                    .limit(1)
                )
                h_res = await session.execute(latest_history_stmt)
                status_date = h_res.scalar_one_or_none()
                base_date = status_date.date() if status_date else inst.created_at.date()
                days_unresolved = (scan_date - base_date).days

                if days_unresolved >= rule.days:
                    recipients = await _get_recipients_for_role(session, rule.recipient_role, inst)
                    for user in recipients:
                        for channel in rule.channels:
                            existing_stmt = select(Alert.id).where(
                                Alert.instrument_id == inst.id,
                                Alert.rule_id == rule.id,
                                Alert.recipient_user_id == user.id,
                                Alert.channel == channel,
                                Alert.escalation_level == 0,
                            )
                            existing_res = await session.execute(existing_stmt)
                            if existing_res.scalar_one_or_none() is not None:
                                continue

                            alert = Alert(
                                instrument_id=inst.id,
                                rule_id=rule.id,
                                rule_name=rule.name,
                                recipient_user_id=user.id,
                                channel=channel,
                                scheduled_for=scan_date,
                                escalation_level=0,
                                status=AlertStatus.PENDING,
                            )
                            session.add(alert)
                            await session.flush()
                            alerts_created += 1

                            if channel == AlertChannel.IN_APP.value:
                                await create_notification(
                                    session,
                                    user_id=user.id,
                                    title=f"Discrepancy Unresolved: {rule.name}",
                                    body=f"Instrument {inst.reference_number} has had an unresolved discrepancy for {days_unresolved} days.",
                                    alert_id=alert.id,
                                )

        elif rule.rule_type == AlertRuleType.RELEASE_PENDING:
            # Check release requests pending review or awaiting approval past threshold days
            if rule.recipient_role == UserRole.VERIFYING_OFFICER:
                req_stmt = (
                    select(ReleaseRequest)
                    .join(Instrument, ReleaseRequest.instrument_id == Instrument.id)
                    .options(selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution))
                    .where(ReleaseRequest.status == ReleaseRequestStatus.PENDING)
                )
                reqs = (await session.execute(req_stmt)).scalars().all()
                for r in reqs:
                    days_pending = (scan_date - r.created_at.date()).days
                    if days_pending >= rule.days:
                        recipients = await _get_recipients_for_role(session, rule.recipient_role, r.instrument)
                        for user in recipients:
                            for channel in rule.channels:
                                existing_stmt = select(Alert.id).where(
                                    Alert.instrument_id == r.instrument_id,
                                    Alert.rule_id == rule.id,
                                    Alert.recipient_user_id == user.id,
                                    Alert.channel == channel,
                                    Alert.escalation_level == 0,
                                )
                                if (await session.execute(existing_stmt)).scalar_one_or_none() is not None:
                                    continue
                                alert = Alert(
                                    instrument_id=r.instrument_id,
                                    rule_id=rule.id,
                                    rule_name=rule.name,
                                    recipient_user_id=user.id,
                                    channel=channel,
                                    scheduled_for=scan_date,
                                    escalation_level=0,
                                    status=AlertStatus.PENDING,
                                )
                                session.add(alert)
                                await session.flush()
                                alerts_created += 1
                                if channel == AlertChannel.IN_APP.value:
                                    await create_notification(
                                        session,
                                        user_id=user.id,
                                        title=f"Release Pending Review: {rule.name}",
                                        body=f"Release request for FDR {r.instrument.reference_number} has been pending review for {days_pending} days.",
                                        alert_id=alert.id,
                                    )

            elif rule.recipient_role == UserRole.APPROVING_AUTHORITY:
                req_stmt = (
                    select(ReleaseRequest)
                    .join(Instrument, ReleaseRequest.instrument_id == Instrument.id)
                    .options(selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution))
                    .where(
                        ReleaseRequest.status == ReleaseRequestStatus.UNDER_REVIEW,
                        ReleaseRequest.recommended_at.is_not(None),
                    )
                )
                reqs = (await session.execute(req_stmt)).scalars().all()
                for r in reqs:
                    days_awaiting = (scan_date - r.recommended_at.date()).days
                    if days_awaiting >= rule.days:
                        recipients = await _get_recipients_for_role(session, rule.recipient_role, r.instrument)
                        for user in recipients:
                            for channel in rule.channels:
                                existing_stmt = select(Alert.id).where(
                                    Alert.instrument_id == r.instrument_id,
                                    Alert.rule_id == rule.id,
                                    Alert.recipient_user_id == user.id,
                                    Alert.channel == channel,
                                    Alert.escalation_level == 0,
                                )
                                if (await session.execute(existing_stmt)).scalar_one_or_none() is not None:
                                    continue
                                alert = Alert(
                                    instrument_id=r.instrument_id,
                                    rule_id=rule.id,
                                    rule_name=rule.name,
                                    recipient_user_id=user.id,
                                    channel=channel,
                                    scheduled_for=scan_date,
                                    escalation_level=0,
                                    status=AlertStatus.PENDING,
                                )
                                session.add(alert)
                                await session.flush()
                                alerts_created += 1
                                if channel == AlertChannel.IN_APP.value:
                                    await create_notification(
                                        session,
                                        user_id=user.id,
                                        title=f"Release Awaiting Approval: {rule.name}",
                                        body=f"Release request for FDR {r.instrument.reference_number} has been awaiting approval for {days_awaiting} days.",
                                        alert_id=alert.id,
                                    )

    if dry_run:
        await session.rollback()
    else:
        await session.commit()

    return {
        "as_of": scan_date.isoformat(),
        "dry_run": dry_run,
        "transitioned_expiring": transitioned_expiring,
        "transitioned_matured": transitioned_matured,
        "alerts_created": alerts_created,
    }
