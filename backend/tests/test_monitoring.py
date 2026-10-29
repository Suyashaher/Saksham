"""Tests for the automated daily monitoring scan and admin job triggers."""

from __future__ import annotations

import datetime
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.db.enums import AlertChannel, AlertRuleType, FDRStatus, UserRole, VerificationTag
from app.db.models.alert_rule import AlertRule
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.services.monitoring import run_daily_scan


@pytest.mark.asyncio
async def test_monitoring_daily_scan_lifecycle(
    client: AsyncClient,
    db_session: AsyncSession,
    inst_user: User,
    admin_token: str,
):
    """Test transitions to EXPIRING and MATURED, alert generation, and idempotency."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    today_date = clock.today()

    # 1. Create AlertRule for 90d reminder
    rule = AlertRule(
        name=f"Monitoring Rule {uuid.uuid4().hex[:6]}",
        rule_type=AlertRuleType.MATURITY_REMINDER,
        days=90,
        channels=[AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
        recipient_role=UserRole.INSTITUTION,
        is_active=True,
    )
    db_session.add(rule)

    # 2. Instrument 1: ACTIVE, matures in 80 days -> should transition to EXPIRING and get alert
    inst1 = Instrument(
        institution_id=inst_user.institution_id,
        reference_number=f"FDR-MON-80D-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today_date - datetime.timedelta(days=285),
        maturity_date=today_date + datetime.timedelta(days=80),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )

    # 3. Instrument 2: EXPIRING, matured 2 days ago -> should transition to MATURED
    inst2 = Instrument(
        institution_id=inst_user.institution_id,
        reference_number=f"FDR-MON-MAT-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today_date - datetime.timedelta(days=367),
        maturity_date=today_date - datetime.timedelta(days=2),
        status=FDRStatus.EXPIRING,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )

    db_session.add_all([inst1, inst2])
    await db_session.commit()

    # 4. Dry run: computes transitions without saving
    dry_result = await run_daily_scan(db_session, as_of=today_date, dry_run=True)
    assert dry_result["dry_run"] is True
    assert dry_result["transitioned_expiring"] >= 1

    # Reload inst1 — should still be ACTIVE after dry run
    await db_session.refresh(inst1)
    assert inst1.status == FDRStatus.ACTIVE

    # 5. Live run: applies transitions and generates alerts
    live_result = await run_daily_scan(db_session, as_of=today_date, dry_run=False)
    assert live_result["dry_run"] is False
    assert live_result["transitioned_expiring"] >= 1
    assert live_result["transitioned_matured"] >= 1
    assert live_result["alerts_created"] >= 1

    await db_session.refresh(inst1)
    await db_session.refresh(inst2)
    assert inst1.status == FDRStatus.EXPIRING
    assert inst2.status == FDRStatus.MATURED

    # 6. Idempotency: re-running scan on same day generates 0 duplicate alerts
    repeat_result = await run_daily_scan(db_session, as_of=today_date, dry_run=False)
    assert repeat_result["alerts_created"] == 0


@pytest.mark.asyncio
async def test_admin_job_endpoint_demo_mode_guard(
    client: AsyncClient,
    admin_token: str,
    monkeypatch,
):
    """Passing as_of to /admin/jobs/run-daily-scan is rejected when DEMO_MODE=false."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    settings = get_settings()

    # DEMO_MODE = False -> as_of rejected with 400
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    res_bad = await client.post(
        "/admin/jobs/run-daily-scan",
        json={"as_of": "2026-11-01"},
        headers=headers_admin,
    )
    assert res_bad.status_code == 400
    assert "DEMO_MODE" in res_bad.json()["detail"]

    # DEMO_MODE = True -> as_of accepted
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    res_ok = await client.post(
        "/admin/jobs/run-daily-scan",
        json={"as_of": "2026-11-01", "dry_run": True},
        headers=headers_admin,
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["as_of"] == "2026-11-01"
