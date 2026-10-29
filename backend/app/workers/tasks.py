"""Celery task implementations for daily monitoring, alert delivery, and escalation."""

from __future__ import annotations

import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core import clock
from app.core.config import get_settings
from app.db.enums import AlertChannel, AlertRuleType, AlertStatus
from app.db.models.alert import Alert
from app.db.models.alert_rule import AlertRule
from app.db.models.instrument import Instrument
from app.db.session import async_session_factory
from app.services.alert_sender import (
    get_email_sender,
    get_sms_sender,
    mask_reference_number,
    render_template,
)
from app.services.escalation import run_escalation
from app.services.monitoring import run_daily_scan
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)
settings = get_settings()


async def _async_daily_scan(as_of=None, dry_run=False):
    async with async_session_factory() as session:
        return await run_daily_scan(session, as_of=as_of, dry_run=dry_run)


async def _async_run_escalation(as_of=None):
    async with async_session_factory() as session:
        result = await run_escalation(session, as_of=as_of)
        await session.commit()
        return result


async def _async_deliver_alert(alert_id):
    """Deliver a single pending alert. Isolated transaction per alert."""
    email_sender = get_email_sender()
    sms_sender = get_sms_sender()

    async with async_session_factory() as session:
        stmt = (
            select(Alert)
            .where(Alert.id == alert_id, Alert.status == AlertStatus.PENDING)
            .options(
                selectinload(Alert.recipient),
                selectinload(Alert.instrument).selectinload(Instrument.institution),
                selectinload(Alert.rule),
            )
        )
        res = await session.execute(stmt)
        alert = res.scalar_one_or_none()
        if not alert:
            return

        inst = alert.instrument
        institution = inst.institution if inst else None
        inst_name = institution.name if institution else "Educational Institution"
        ref_masked = mask_reference_number(inst.reference_number if inst else "")
        today_date = clock.today()
        days_left = (inst.maturity_date - today_date).days if inst else 0
        days_overdue = (today_date - inst.maturity_date).days if inst else 0

        context = {
            "institution_name": inst_name,
            "ref_number_masked": ref_masked,
            "maturity_date": inst.maturity_date.isoformat() if inst else "",
            "days_remaining": max(0, days_left),
            "days_overdue": max(0, days_overdue),
            "days_stale": 30,
            "days_unresolved": 14,
            "current_status": inst.status.value if inst else "",
            "portal_url": settings.PORTAL_URL,
        }

        try:
            if alert.channel == AlertChannel.EMAIL.value:
                recipient_email = alert.recipient.email if alert.recipient else None
                if not recipient_email:
                    raise ValueError(f"No recipient email found for alert {alert.id}")

                rule_type = alert.rule.rule_type if alert.rule else AlertRuleType.MATURITY_REMINDER
                if rule_type == AlertRuleType.OVERDUE_MATURED:
                    html_tmpl, txt_tmpl = "overdue_matured.html", "overdue_matured.txt"
                    subject = f"URGENT: AICTE Security Deposit Matured ({ref_masked})"
                elif rule_type == AlertRuleType.STALE_VERIFICATION:
                    html_tmpl, txt_tmpl = "stale_verification.html", "stale_verification.txt"
                    subject = f"AICTE Alert: Stale FDR Scrutiny ({ref_masked})"
                elif rule_type == AlertRuleType.DISCREPANCY_UNRESOLVED:
                    html_tmpl, txt_tmpl = "discrepancy_unresolved.html", "discrepancy_unresolved.txt"
                    subject = f"AICTE Notice: Unresolved FDR Discrepancy ({ref_masked})"
                else:
                    html_tmpl, txt_tmpl = "maturity_reminder.html", "maturity_reminder.txt"
                    subject = f"AICTE Security Deposit Maturity Reminder ({ref_masked})"

                html_content = render_template(html_tmpl, context)
                txt_content = render_template(txt_tmpl, context)
                await email_sender.send(recipient_email, subject, html_content, txt_content)

            elif alert.channel == AlertChannel.SMS.value:
                phone = (alert.recipient.phone if alert.recipient else None) or (
                    institution.contact_phone if institution else None
                )
                if not phone:
                    raise ValueError(f"No recipient phone number found for alert {alert.id}")

                body = render_template("sms_maturity.txt", context)
                await sms_sender.send(phone, body)

            elif alert.channel == AlertChannel.IN_APP.value:
                # In-app notifications are created at alert generation time
                pass

            alert.status = AlertStatus.SENT
            alert.sent_at = clock.now()
            alert.last_error = None

        except Exception as exc:
            logger.warning("Error delivering alert %s: %s", alert.id, exc)
            alert.failure_count += 1
            alert.last_error = str(exc)
            if alert.failure_count >= settings.ALERT_MAX_ATTEMPTS:
                alert.status = AlertStatus.FAILED

        await session.commit()


async def _async_send_pending_alerts(batch_size: int = 50):
    async with async_session_factory() as session:
        stmt = (
            select(Alert.id)
            .where(Alert.status == AlertStatus.PENDING)
            .limit(batch_size)
        )
        res = await session.execute(stmt)
        alert_ids = list(res.scalars().all())

    for aid in alert_ids:
        await _async_deliver_alert(aid)

    return len(alert_ids)


# ── Celery Tasks ──────────────────────────────────────────────────────────────


@celery_app.task(name="workers.tasks.daily_scan_task")
def daily_scan_task():
    """Celery task to run the daily monitoring scan."""
    logger.info("Starting daily_scan_task")
    return asyncio.run(_async_daily_scan())


@celery_app.task(name="workers.tasks.send_pending_alerts_task")
def send_pending_alerts_task(batch_size: int = 50):
    """Celery task to deliver pending alerts."""
    logger.info("Starting send_pending_alerts_task")
    return asyncio.run(_async_send_pending_alerts(batch_size))


@celery_app.task(name="workers.tasks.run_escalation_task")
def run_escalation_task():
    """Celery task to run alert escalation checks."""
    logger.info("Starting run_escalation_task")
    return asyncio.run(_async_run_escalation())
