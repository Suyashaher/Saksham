"""Tests for alert escalation, acknowledgment, and resolution."""

from __future__ import annotations

import datetime
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.db.enums import AlertChannel, AlertEscalationLevel, AlertRuleType, AlertStatus, FDRStatus, UserRole, VerificationTag
from app.db.models.alert import Alert
from app.db.models.alert_rule import AlertRule
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.services.escalation import acknowledge_alert, auto_resolve_alerts, resolve_alert, run_escalation


@pytest.mark.asyncio
async def test_escalation_flow(
    client: AsyncClient,
    db_session: AsyncSession,
    inst_user: User,
    officer_user: User,
    officer_token: str,
    inst_token: str,
):
    """Verify level 0 -> level 1 escalation, acknowledgment, and resolution."""
    headers_officer = {"Authorization": f"Bearer {officer_token}"}
    headers_inst = {"Authorization": f"Bearer {inst_token}"}

    today_date = clock.today()

    # 1. Create Instrument & AlertRule with escalate_after_days=7
    inst = Instrument(
        institution_id=inst_user.institution_id,
        reference_number=f"FDR-ESC-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("100000.00"),
        issue_date=today_date - datetime.timedelta(days=365),
        maturity_date=today_date + datetime.timedelta(days=10),
        status=FDRStatus.EXPIRING,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    rule = AlertRule(
        name=f"Escalation Rule {uuid.uuid4().hex[:6]}",
        rule_type=AlertRuleType.MATURITY_REMINDER,
        days=30,
        channels=[AlertChannel.EMAIL.value],
        recipient_role=UserRole.INSTITUTION,
        escalate_after_days=7,
        is_active=True,
    )
    db_session.add_all([inst, rule])
    await db_session.flush()

    # 2. Create Level 0 Alert scheduled 10 days ago (past 7-day threshold)
    alert = Alert(
        instrument_id=inst.id,
        rule_id=rule.id,
        rule_name=rule.name,
        recipient_user_id=inst_user.id,
        channel=AlertChannel.EMAIL.value,
        scheduled_for=today_date - datetime.timedelta(days=10),
        escalation_level=0,
        status=AlertStatus.PENDING,
    )
    db_session.add(alert)
    await db_session.commit()

    # 3. Run escalation — should create Level 1 child alert
    res = await run_escalation(db_session, as_of=today_date)
    assert res["escalated_alerts"] == 1
    await db_session.commit()

    # 4. Query alerts via API
    alerts_res = await client.get(f"/alerts?instrument_id={inst.id}", headers=headers_officer)
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert len(alerts_data) == 2

    child = next(a for a in alerts_data if a["escalation_level"] == 1)
    assert child["parent_alert_id"] == str(alert.id)

    # 5. Acknowledge the child alert
    ack_res = await client.post(f"/alerts/{child['id']}/acknowledge", headers=headers_officer)
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged_at"] is not None

    # Running escalation again should produce 0 new alerts
    re_esc = await run_escalation(db_session, as_of=today_date)
    assert re_esc["escalated_alerts"] == 0

    # 6. Resolve the child alert
    resolve_res = await client.post(
        f"/alerts/{child['id']}/resolve",
        json={"reason": "Discussed with registrar; FDR renewed"},
        headers=headers_officer,
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["resolved"] is True
    assert resolve_res.json()["resolved_reason"] == "Discussed with registrar; FDR renewed"

    # 7. Auto-resolve all remaining alerts for instrument
    resolved_count = await auto_resolve_alerts(db_session, inst.id, "batch_test_resolved")
    assert resolved_count >= 1
