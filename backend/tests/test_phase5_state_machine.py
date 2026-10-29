"""Phase 5: State machine matrix and RELEASED immutability tests."""

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
from app.services.instrument_service import InstrumentService
from app.services.instrument_state import (
    ALLOWED_TRANSITIONS,
    IllegalTransitionError,
    transition,
)


@pytest.fixture
def mock_actor():
    return User(
        id=uuid.uuid4(),
        email="officer@aicte.gov.in",
        role=UserRole.VERIFYING_OFFICER,
    )


@pytest.mark.asyncio
async def test_released_is_terminal(db_session: AsyncSession, mock_actor: User):
    """RELEASED status has no outgoing transitions."""
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        reference_number="FDR-TEST-TERM-1",
        issuing_bank="Test Bank",
        amount=Decimal("500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        status=FDRStatus.RELEASED,
    )
    db_session.add(inst)

    for target in FDRStatus:
        with pytest.raises(IllegalTransitionError):
            await transition(db_session, inst, target, mock_actor)


@pytest.mark.asyncio
async def test_released_instruments_reject_edits(db_session: AsyncSession):
    """RELEASED instruments reject any further modifications via InstrumentService.update."""
    actor = User(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        email="inst@aicte.gov.in",
        role=UserRole.INSTITUTION,
    )
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=actor.institution_id,
        reference_number="FDR-TEST-IMMUTABLE-1",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        status=FDRStatus.RELEASED,
    )
    db_session.add(inst)

    with pytest.raises(ValueError) as exc:
        await InstrumentService.update(
            session=db_session,
            instrument=inst,
            data={"amount": Decimal("2000000.00")},
            actor=actor,
        )
    assert "cannot be edited in status 'RELEASED'" in str(exc.value)


@pytest.mark.asyncio
async def test_renewed_instruments_reject_edits(db_session: AsyncSession):
    """RENEWED instruments reject any further modifications."""
    actor = User(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        email="inst@aicte.gov.in",
        role=UserRole.INSTITUTION,
    )
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=actor.institution_id,
        reference_number="FDR-TEST-IMMUTABLE-2",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        status=FDRStatus.RENEWED,
    )
    db_session.add(inst)

    with pytest.raises(ValueError) as exc:
        await InstrumentService.update(
            session=db_session,
            instrument=inst,
            data={"amount": Decimal("1500000.00")},
            actor=actor,
        )
    assert "cannot be edited in status 'RENEWED'" in str(exc.value)


@pytest.mark.asyncio
async def test_restoring_previous_status_validation(db_session: AsyncSession, mock_actor: User):
    """Transitioning out of RELEASE_REQUESTED must strictly restore status_before_release_request."""
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=uuid.uuid4(),
        reference_number="FDR-TEST-PREV-1",
        issuing_bank="Test Bank",
        amount=Decimal("500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        status=FDRStatus.ACTIVE,
    )
    db_session.add(inst)

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        # 1. Move to RELEASE_REQUESTED (saves status_before_release_request = ACTIVE)
        await transition(db_session, inst, FDRStatus.RELEASE_REQUESTED, mock_actor)
        assert inst.status == FDRStatus.RELEASE_REQUESTED
        assert inst.status_before_release_request == "ACTIVE"

        # 2. Trying to restore MATURED fails
        with pytest.raises(IllegalTransitionError) as exc:
            await transition(db_session, inst, FDRStatus.MATURED, mock_actor)
        assert "Must restore previous status 'ACTIVE'" in str(exc.value)

        # 3. Restoring ACTIVE succeeds
        await transition(db_session, inst, FDRStatus.ACTIVE, mock_actor)
        assert inst.status == FDRStatus.ACTIVE
