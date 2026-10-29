"""Tests for instrument CRUD endpoints, scoping, and validation."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FDRStatus, VerificationTag
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.user import User


@pytest.mark.asyncio
async def test_create_instrument_happy_path(
    client: AsyncClient,
    institution_user_1: User,
    inst1_headers: dict[str, str],
):
    """Institution user can create an instrument with SUBMITTED status."""
    today = date.today()
    payload = {
        "reference_number": f"FDR-CREATE-{uuid.uuid4().hex[:6]}",
        "issuing_bank": "State Bank of India",
        "branch": "Main Branch",
        "amount": "1000000.00",
        "required_amount": "1000000.00",
        "issue_date": (today - timedelta(days=10)).isoformat(),
        "maturity_date": (today + timedelta(days=365 * 3)).isoformat(),
    }

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        resp = await client.post("/instruments/", json=payload, headers=inst1_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["instrument"]["status"] == "SUBMITTED"
        assert data["instrument"]["verification_tag"] == "SELF_DECLARED"
        assert data["instrument"]["institution_id"] == str(institution_user_1.institution_id)
        assert data["warnings"] == []
        mock_audit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_instrument_validation_failure(
    client: AsyncClient,
    inst1_headers: dict[str, str],
):
    """Validation errors return 422 Unprocessable Entity."""
    today = date.today()
    payload = {
        "reference_number": "INVALID REF #$%",
        "issuing_bank": "State Bank of India",
        "amount": "50000.00",
        "required_amount": "100000.00",  # Shortfall!
        "issue_date": (today + timedelta(days=10)).isoformat(),  # Future issue date!
        "maturity_date": (today - timedelta(days=10)).isoformat(),  # Past maturity date!
    }

    resp = await client.post("/instruments/", json=payload, headers=inst1_headers)
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    assert any("amount_vs_required" in str(e) for e in errors)


@pytest.mark.asyncio
async def test_get_instrument_scoped_404_not_403(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_2: Institution,
    inst1_headers: dict[str, str],
):
    """Institution 1 attempting to view Institution 2's instrument must receive 404 (not 403)."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_2.id,
        reference_number=f"FDR-SCOPED-{uuid.uuid4().hex[:6]}",
        issuing_bank="Bank of Baroda",
        amount=Decimal("500000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    resp = await client.get(f"/instruments/{inst.id}", headers=inst1_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Instrument not found"


@pytest.mark.asyncio
async def test_patch_cannot_set_bank_verified(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    inst1_headers: dict[str, str],
):
    """Test explicitly proving PATCH cannot set verification_tag to BANK_VERIFIED."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-TAG-SEC-{uuid.uuid4().hex[:6]}",
        issuing_bank="Punjab National Bank",
        amount=Decimal("500000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
        verification_tag=VerificationTag.SELF_DECLARED,
    )
    db_session.add(inst)
    await db_session.commit()

    # Attempt to elevate to BANK_VERIFIED via PATCH
    resp = await client.patch(
        f"/instruments/{inst.id}",
        json={"verification_tag": "BANK_VERIFIED"},
        headers=inst1_headers,
    )
    assert resp.status_code == 400
    assert "Cannot manually set verification_tag to BANK_VERIFIED" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_patch_rejected_outside_submitted_or_discrepancy(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    inst1_headers: dict[str, str],
):
    """Editing when status is UNDER_SCRUTINY, VERIFIED, or ACTIVE must return 409."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-LOCK-{uuid.uuid4().hex[:6]}",
        issuing_bank="Punjab National Bank",
        amount=Decimal("500000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.UNDER_SCRUTINY,
    )
    db_session.add(inst)
    await db_session.commit()

    resp = await client.patch(
        f"/instruments/{inst.id}",
        json={"branch": "New Branch"},
        headers=inst1_headers,
    )
    assert resp.status_code == 409
    assert "cannot be edited in status 'UNDER_SCRUTINY'" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_patch_logs_before_after_in_audit(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    inst1_headers: dict[str, str],
):
    """PATCH logs before and after field changes in audit payload."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-AUDIT-CHG-{uuid.uuid4().hex[:6]}",
        issuing_bank="Punjab National Bank",
        branch="Old Branch",
        amount=Decimal("500000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        resp = await client.patch(
            f"/instruments/{inst.id}",
            json={"branch": "Updated Branch"},
            headers=inst1_headers,
        )
        assert resp.status_code == 200
        mock_audit.assert_awaited_once()
        _, kwargs = mock_audit.call_args
        payload = kwargs.get("payload", {})
        assert payload["before"]["branch"] == "Old Branch"
        assert payload["after"]["branch"] == "Updated Branch"
