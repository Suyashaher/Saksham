"""Test database constraints (check constraints, foreign keys, uniqueness)."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FDRStatus, UserRole, VerificationTag
from app.db.models import Alert, Institution, Instrument, User


@pytest.fixture
async def sample_institution(db_session: AsyncSession) -> Institution:
    inst = Institution(
        name="Test Institute of Technology",
        aicte_id=f"AICTE-{uuid.uuid4().hex[:8]}",
        state="Maharashtra",
        contact_email="principal@testinst.ac.in",
        contact_phone="9876543210",
        approval_cycle="2025-2026",
    )
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)
    return inst


@pytest.fixture
async def sample_user(
    db_session: AsyncSession, sample_institution: Institution
) -> User:
    user = User(
        email=f"officer_{uuid.uuid4().hex[:8]}@aicte.gov.in",
        full_name="Verification Officer 1",
        hashed_password="secure_hashed_password_placeholder",
        role=UserRole.VERIFYING_OFFICER,
        institution_id=sample_institution.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
async def test_valid_instrument_creation(
    db_session: AsyncSession, sample_institution: Institution
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-{uuid.uuid4().hex[:8]}",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("1500000.00"),
        required_amount=Decimal("1500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        verification_tag=VerificationTag.SELF_DECLARED,
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)

    assert inst.id is not None
    assert inst.amount == Decimal("1500000.00")
    assert inst.status == FDRStatus.SUBMITTED


@pytest.mark.asyncio
async def test_instrument_negative_amount_rejected(
    db_session: AsyncSession, sample_institution: Institution
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-{uuid.uuid4().hex[:8]}",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("-500.00"),  # Invalid amount
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
    )
    db_session.add(inst)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()
    await db_session.rollback()
    assert "ck_instrument_amount_positive" in str(exc_info.value)


@pytest.mark.asyncio
async def test_instrument_zero_amount_rejected(
    db_session: AsyncSession, sample_institution: Institution
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-{uuid.uuid4().hex[:8]}",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("0.00"),  # Invalid amount (must be > 0)
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
    )
    db_session.add(inst)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()
    await db_session.rollback()
    assert "ck_instrument_amount_positive" in str(exc_info.value)


@pytest.mark.asyncio
async def test_instrument_maturity_before_issue_rejected(
    db_session: AsyncSession, sample_institution: Institution
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-{uuid.uuid4().hex[:8]}",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 6, 1),
        maturity_date=date(2025, 1, 1),  # Maturity BEFORE issue
    )
    db_session.add(inst)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()
    await db_session.rollback()
    assert "ck_instrument_maturity_after_issue" in str(exc_info.value)


@pytest.mark.asyncio
async def test_instrument_maturity_equals_issue_rejected(
    db_session: AsyncSession, sample_institution: Institution
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-{uuid.uuid4().hex[:8]}",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 6, 1),
        maturity_date=date(2025, 6, 1),  # Maturity EQUALS issue
    )
    db_session.add(inst)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()
    await db_session.rollback()
    assert "ck_instrument_maturity_after_issue" in str(exc_info.value)


@pytest.mark.asyncio
async def test_instrument_duplicate_reference_number_rejected(
    db_session: AsyncSession, sample_institution: Institution
):
    ref_num = f"FDR-DUP-{uuid.uuid4().hex[:6]}"
    inst1 = Instrument(
        institution_id=sample_institution.id,
        reference_number=ref_num,
        issuing_bank="Bank A",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
    )
    db_session.add(inst1)
    await db_session.commit()

    inst2 = Instrument(
        institution_id=sample_institution.id,
        reference_number=ref_num,
        issuing_bank="Bank B",
        amount=Decimal("200000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
    )
    db_session.add(inst2)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_alert_escalation_level_constraint(
    db_session: AsyncSession,
    sample_institution: Institution,
    sample_user: User,
):
    inst = Instrument(
        institution_id=sample_institution.id,
        reference_number=f"FDR-ALERT-{uuid.uuid4().hex[:6]}",
        issuing_bank="Bank A",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
    )
    db_session.add(inst)
    await db_session.commit()

    # Valid escalation levels 0, 1, 2
    alert_valid = Alert(
        instrument_id=inst.id,
        rule_name="EXPIRY_REMINDER_90_DAYS",
        recipient_user_id=sample_user.id,
        channel="EMAIL",
        scheduled_at=datetime.now(timezone.utc),
        escalation_level=0,
    )
    db_session.add(alert_valid)
    await db_session.commit()

    # Invalid escalation level 3
    alert_invalid = Alert(
        instrument_id=inst.id,
        rule_name="INVALID_ESCALATION",
        recipient_user_id=sample_user.id,
        channel="EMAIL",
        scheduled_at=datetime.now(timezone.utc),
        escalation_level=3,
    )
    db_session.add(alert_invalid)
    with pytest.raises(IntegrityError) as exc_info:
        await db_session.commit()
    await db_session.rollback()
    assert "ck_alert_escalation_level" in str(exc_info.value)
