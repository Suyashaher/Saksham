"""Tests for officer scrutiny workflow, observations, and discrepancy handling."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FDRStatus
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.user import User


@pytest.mark.asyncio
async def test_full_scrutiny_happy_path_to_active(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    officer_user: User,
    officer_headers: dict[str, str],
    approver_headers: dict[str, str],
):
    """Happy path: SUBMITTED -> UNDER_SCRUTINY -> VERIFIED -> ACTIVE."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-SCRUT-OK-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365 * 3),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    # 1. Start scrutiny
    resp = await client.post(f"/instruments/{inst.id}/start-scrutiny", headers=officer_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "UNDER_SCRUTINY"
    assert resp.json()["assigned_officer_id"] == str(officer_user.id)

    # 2. Add an observation
    obs_resp = await client.post(
        f"/instruments/{inst.id}/observations",
        json={"category": "documentation", "text": "All FDR papers verified.", "severity": "INFO"},
        headers=officer_headers,
    )
    assert obs_resp.status_code == 201
    assert obs_resp.json()["text"] == "All FDR papers verified."

    # 3. Mark verified
    mv_resp = await client.post(f"/instruments/{inst.id}/mark-verified", headers=officer_headers)
    assert mv_resp.status_code == 200
    assert mv_resp.json()["status"] == "VERIFIED"

    # 4. Activate (Verifying officer forbidden -> 403)
    act_forbidden = await client.post(f"/instruments/{inst.id}/activate", headers=officer_headers)
    assert act_forbidden.status_code == 403

    # 5. Activate (Approving authority allowed -> 200)
    act_ok = await client.post(f"/instruments/{inst.id}/activate", headers=approver_headers)
    assert act_ok.status_code == 200
    assert act_ok.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_discrepancy_and_resubmit_path(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    officer_headers: dict[str, str],
    inst1_headers: dict[str, str],
):
    """Discrepancy path: SUBMITTED -> UNDER_SCRUTINY -> DISCREPANCY -> institution resubmits -> SUBMITTED."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-DISC-FLOW-{uuid.uuid4().hex[:6]}",
        issuing_bank="Punjab National Bank",
        amount=Decimal("500000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    # Move to UNDER_SCRUTINY
    await client.post(f"/instruments/{inst.id}/start-scrutiny", headers=officer_headers)

    # Flag discrepancy
    disc_resp = await client.post(
        f"/instruments/{inst.id}/flag-discrepancy",
        json={"notes": "Branch stamp is missing from FDR certificate"},
        headers=officer_headers,
    )
    assert disc_resp.status_code == 200
    assert disc_resp.json()["status"] == "DISCREPANCY"

    # Institution updates and resubmits
    patch_resp = await client.patch(
        f"/instruments/{inst.id}",
        json={"branch": "Verified Branch with Stamp"},
        headers=inst1_headers,
    )
    assert patch_resp.status_code == 200

    resubmit_resp = await client.post(f"/instruments/{inst.id}/resubmit", headers=inst1_headers)
    assert resubmit_resp.status_code == 200
    assert resubmit_resp.json()["status"] == "SUBMITTED"


@pytest.mark.asyncio
async def test_officer_queue_contents(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    officer_user: User,
    officer_headers: dict[str, str],
):
    """Queue returns unassigned SUBMITTED and assigned UNDER_SCRUTINY instruments."""
    today = date.today()
    i1 = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-Q1-{uuid.uuid4().hex[:6]}",
        issuing_bank="Bank A",
        amount=Decimal("100000"),
        issue_date=today - timedelta(days=5),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
        assigned_officer_id=None,
    )
    i2 = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-Q2-{uuid.uuid4().hex[:6]}",
        issuing_bank="Bank B",
        amount=Decimal("100000"),
        issue_date=today - timedelta(days=5),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.UNDER_SCRUTINY,
        assigned_officer_id=officer_user.id,
    )
    i3 = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-Q3-{uuid.uuid4().hex[:6]}",
        issuing_bank="Bank C",
        amount=Decimal("100000"),
        issue_date=today - timedelta(days=5),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.ACTIVE,  # Not in scrutiny queue
    )
    db_session.add_all([i1, i2, i3])
    await db_session.commit()

    resp = await client.get("/instruments/queue", headers=officer_headers)
    assert resp.status_code == 200
    refs = [item["reference_number"] for item in resp.json()["items"]]
    assert i1.reference_number in refs
    assert i2.reference_number in refs
    assert i3.reference_number not in refs
