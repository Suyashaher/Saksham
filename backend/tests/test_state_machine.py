"""Tests for the FDR instrument state machine."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FDRStatus, UserRole
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.services.instrument_state import (
    ALLOWED_TRANSITIONS,
    IllegalTransitionError,
    transition,
)


@pytest.mark.asyncio
async def test_allowed_transitions_succeed(db_session: AsyncSession, officer_user: User):
    """Assert all 5 allowed transitions update status and record history/audit."""
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        reference_number="FDR-TEST-SM-1",
        issuing_bank="Test Bank",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)

    # 1. SUBMITTED -> UNDER_SCRUTINY
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h1 = await transition(db_session, inst, FDRStatus.UNDER_SCRUTINY, officer_user)
        assert inst.status == FDRStatus.UNDER_SCRUTINY
        assert h1.from_status == FDRStatus.SUBMITTED
        assert h1.to_status == FDRStatus.UNDER_SCRUTINY
        mock_audit.assert_awaited_once()

    # 2. UNDER_SCRUTINY -> DISCREPANCY
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h2 = await transition(db_session, inst, FDRStatus.DISCREPANCY, officer_user, note="Wrong amount")
        assert inst.status == FDRStatus.DISCREPANCY
        assert h2.from_status == FDRStatus.UNDER_SCRUTINY
        assert h2.to_status == FDRStatus.DISCREPANCY
        assert h2.note == "Wrong amount"

    # 3. DISCREPANCY -> SUBMITTED (resubmission)
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h3 = await transition(db_session, inst, FDRStatus.SUBMITTED, officer_user)
        assert inst.status == FDRStatus.SUBMITTED
        assert h3.to_status == FDRStatus.SUBMITTED

    # 4. SUBMITTED -> UNDER_SCRUTINY -> VERIFIED
    await transition(db_session, inst, FDRStatus.UNDER_SCRUTINY, officer_user)
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h4 = await transition(db_session, inst, FDRStatus.VERIFIED, officer_user)
        assert inst.status == FDRStatus.VERIFIED
        assert h4.to_status == FDRStatus.VERIFIED

    # 5. VERIFIED -> ACTIVE
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h5 = await transition(db_session, inst, FDRStatus.ACTIVE, officer_user)
        assert inst.status == FDRStatus.ACTIVE
        assert h5.to_status == FDRStatus.ACTIVE

    # 6. ACTIVE -> EXPIRING
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h6 = await transition(db_session, inst, FDRStatus.EXPIRING, officer_user)
        assert inst.status == FDRStatus.EXPIRING
        assert h6.to_status == FDRStatus.EXPIRING

    # 7. EXPIRING -> MATURED
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h7 = await transition(db_session, inst, FDRStatus.MATURED, officer_user)
        assert inst.status == FDRStatus.MATURED
        assert h7.to_status == FDRStatus.MATURED

    # 8. MATURED -> RENEWED
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock) as mock_audit:
        h8 = await transition(db_session, inst, FDRStatus.RENEWED, officer_user)
        assert inst.status == FDRStatus.RENEWED
        assert h8.to_status == FDRStatus.RENEWED

    # 9. ACTIVE -> RENEWED
    inst.status = FDRStatus.ACTIVE
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        h9 = await transition(db_session, inst, FDRStatus.RENEWED, officer_user)
        assert inst.status == FDRStatus.RENEWED

    # 10. EXPIRING -> RENEWED
    inst.status = FDRStatus.EXPIRING
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        h10 = await transition(db_session, inst, FDRStatus.RENEWED, officer_user)
        assert inst.status == FDRStatus.RENEWED

    # 11. ACTIVE -> RELEASE_REQUESTED -> RELEASED (Phase 5)
    inst.status = FDRStatus.ACTIVE
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        h11 = await transition(db_session, inst, FDRStatus.RELEASE_REQUESTED, officer_user)
        assert inst.status == FDRStatus.RELEASE_REQUESTED
        assert inst.status_before_release_request == FDRStatus.ACTIVE.value

        h12 = await transition(db_session, inst, FDRStatus.RELEASED, officer_user)
        assert inst.status == FDRStatus.RELEASED

    # 12. RELEASE_REQUESTED -> Previous Status Reversion (Rejection / Withdrawal)
    inst.status = FDRStatus.EXPIRING
    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        await transition(db_session, inst, FDRStatus.RELEASE_REQUESTED, officer_user)
        assert inst.status == FDRStatus.RELEASE_REQUESTED
        assert inst.status_before_release_request == FDRStatus.EXPIRING.value

        # Returning to EXPIRING succeeds
        h13 = await transition(db_session, inst, FDRStatus.EXPIRING, officer_user)
        assert inst.status == FDRStatus.EXPIRING


@pytest.mark.asyncio
async def test_illegal_transitions_rejected(db_session: AsyncSession, officer_user: User):
    """Enumerate all possible (from_status, to_status) pairs and assert only allowed ones succeed."""
    all_statuses = list(FDRStatus)

    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        reference_number="FDR-TEST-SM-2",
        issuing_bank="Test Bank",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
    )

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        for from_st in all_statuses:
            allowed_targets = ALLOWED_TRANSITIONS.get(from_st, set())
            for to_st in all_statuses:
                inst.status = from_st
                if from_st == FDRStatus.RELEASE_REQUESTED and to_st != FDRStatus.RELEASED:
                    inst.status_before_release_request = to_st.value
                else:
                    inst.status_before_release_request = None

                if to_st in allowed_targets:
                    # Allowed transition
                    history = await transition(db_session, inst, to_st, officer_user)
                    assert history.to_status == to_st
                else:
                    # Illegal transition
                    with pytest.raises(IllegalTransitionError) as exc_info:
                        await transition(db_session, inst, to_st, officer_user)
                    assert exc_info.value.from_status == from_st
                    assert exc_info.value.to_status == to_st
