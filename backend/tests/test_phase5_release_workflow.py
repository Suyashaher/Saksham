"""Phase 5: Release and refund workflow tests."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import (
    ConditionResultEnum,
    FDRStatus,
    OfficerRecommendation,
    ReleaseRequestStatus,
    ReleaseRequestType,
    UserRole,
    VerificationTag,
)
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.release_condition import ReleaseCondition, ReleaseConditionResult
from app.db.models.user import User
from app.schemas.release import (
    ConditionResultUpdateItem,
    RecommendationRequest,
    RejectionRequest,
    ReleaseRequestCreate,
)
from app.services.release_conditions import evaluate_automatic_conditions
from app.services.release_service import ReleaseService


@pytest.fixture
def institution_user():
    inst_id = uuid.uuid4()
    return User(
        id=uuid.uuid4(),
        email="inst@aicte.ac.in",
        role=UserRole.INSTITUTION,
        institution_id=inst_id,
        is_active=True,
    )


@pytest.fixture
def officer_user():
    return User(
        id=uuid.uuid4(),
        email="officer@aicte.gov.in",
        role=UserRole.VERIFYING_OFFICER,
        is_active=True,
    )


@pytest.fixture
def approver_user():
    return User(
        id=uuid.uuid4(),
        email="approver@aicte.gov.in",
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_release_happy_path(
    db_session: AsyncSession,
    institution_user: User,
    officer_user: User,
    approver_user: User,
):
    """Full happy path: submit release -> start review -> pass conditions -> recommend -> approve."""
    # 1. Setup Institution & Bank-Verified Active Instrument
    institution = Institution(
        id=institution_user.institution_id,
        name="Tech Institute",
        aicte_id="AICTE-TECH-01",
        state="Maharashtra",
        contact_email="tech@aicte.ac.in",
    )
    db_session.add(institution)

    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=institution.id,
        reference_number="FDR-REL-HAPPY-01",
        issuing_bank="State Bank of India",
        amount=Decimal("1500000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add(instrument)

    # Add required release conditions
    cond_bank = ReleaseCondition(
        id=uuid.uuid4(),
        code="INSTRUMENT_BANK_VERIFIED",
        description="Bank verified",
        is_mandatory=True,
        is_automatic=True,
        is_active=True,
    )
    cond_manual = ReleaseCondition(
        id=uuid.uuid4(),
        code="APPROVAL_CYCLE_OBLIGATIONS_MET",
        description="Obligations met",
        is_mandatory=True,
        is_automatic=False,
        is_active=True,
    )
    db_session.add_all([cond_bank, cond_manual])
    await db_session.flush()

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        # Step A: Institution Submits Release Request
        create_data = ReleaseRequestCreate(
            request_type=ReleaseRequestType.RELEASE,
            reason="Obligations fulfilled",
            beneficiary_details={
                "account_holder_name": "Tech Institute Trust",
                "account_number": "123456789012",
                "bank_name": "State Bank of India",
                "ifsc_code": "SBIN0001234",
            },
        )
        req = await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=instrument.id,
            user=institution_user,
            data=create_data,
        )
        assert req.status == ReleaseRequestStatus.PENDING
        assert instrument.status == FDRStatus.RELEASE_REQUESTED
        assert instrument.status_before_release_request == "ACTIVE"

        # Step B: Officer Starts Review
        req = await ReleaseService.start_review(
            session=db_session,
            request_id=req.id,
            user=officer_user,
        )
        assert req.status == ReleaseRequestStatus.UNDER_REVIEW

        # Step C: Officer Records Manual Condition PASS
        req = await ReleaseService.record_conditions(
            session=db_session,
            request_id=req.id,
            user=officer_user,
            results_update=[
                ConditionResultUpdateItem(
                    condition_id=cond_manual.id,
                    result=ConditionResultEnum.PASS,
                    notes="Compliance documents verified",
                )
            ],
        )

        # Step D: Officer Recommends
        rec_data = RecommendationRequest(
            recommendation=OfficerRecommendation.RECOMMEND,
            notes="Ready for release",
        )
        req = await ReleaseService.recommend(
            session=db_session,
            request_id=req.id,
            user=officer_user,
            data=rec_data,
        )
        assert req.recommended_by == officer_user.id
        assert req.recommended_at is not None

        # Step E: Approver Approves
        mock_doc_service = AsyncMock()
        mock_doc = Document(
            id=uuid.uuid4(),
            instrument_id=instrument.id,
            doc_type="CLOSURE",
            storage_key="test/key.pdf",
            file_name="AICTE-FDR-REL-2026-000001.pdf",
            sha256="abc123sha",
        )
        mock_doc_service.upload.return_value = mock_doc

        with patch("app.services.escalation.auto_resolve_alerts", new_callable=AsyncMock):
            req = await ReleaseService.approve(
                session=db_session,
                request_id=req.id,
                user=approver_user,
                document_service=mock_doc_service,
            )

        assert req.status == ReleaseRequestStatus.CLOSED
        assert req.closure_document_id == mock_doc.id
        assert instrument.status == FDRStatus.RELEASED


@pytest.mark.asyncio
async def test_mandatory_auto_condition_failure_aborts_creation(
    db_session: AsyncSession,
    institution_user: User,
):
    """If a mandatory automatic condition fails, 422 is raised and no request is created."""
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=institution_user.institution_id,
        reference_number="FDR-FAIL-AUTO-01",
        issuing_bank="Test Bank",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.SELF_DECLARED,  # Will fail BANK_VERIFIED check!
    )
    db_session.add(instrument)

    cond_bank = ReleaseCondition(
        id=uuid.uuid4(),
        code="INSTRUMENT_BANK_VERIFIED",
        description="Bank verified",
        is_mandatory=True,
        is_automatic=True,
        is_active=True,
    )
    db_session.add(cond_bank)
    await db_session.flush()

    create_data = ReleaseRequestCreate(
        request_type=ReleaseRequestType.RELEASE,
        reason="Release test",
    )

    with pytest.raises(HTTPException) as exc:
        await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=instrument.id,
            user=institution_user,
            data=create_data,
        )

    assert exc.value.status_code == 422
    assert instrument.status == FDRStatus.ACTIVE  # Not modified


@pytest.mark.asyncio
async def test_rejection_restores_previous_status(
    db_session: AsyncSession,
    institution_user: User,
    officer_user: User,
):
    """Rejecting a request returns the instrument to its origin status."""
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=institution_user.institution_id,
        reference_number="FDR-REJECT-01",
        issuing_bank="Test Bank",
        amount=Decimal("1000000.00"),
        issue_date=date(2023, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.MATURED,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add(instrument)
    await db_session.flush()

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        create_data = ReleaseRequestCreate(
            request_type=ReleaseRequestType.RELEASE,
            reason="Release matured deposit",
        )
        req = await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=instrument.id,
            user=institution_user,
            data=create_data,
        )
        assert instrument.status == FDRStatus.RELEASE_REQUESTED
        assert instrument.status_before_release_request == "MATURED"

        # Officer rejects
        rej_data = RejectionRequest(reason="Compliance documents missing")
        req = await ReleaseService.reject(
            session=db_session,
            request_id=req.id,
            user=officer_user,
            data=rej_data,
        )
        assert req.status == ReleaseRequestStatus.REJECTED
        assert instrument.status == FDRStatus.MATURED


@pytest.mark.asyncio
async def test_withdraw_only_while_pending(
    db_session: AsyncSession,
    institution_user: User,
    officer_user: User,
):
    """Withdrawal is only permitted when request is PENDING."""
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=institution_user.institution_id,
        reference_number="FDR-WITHDRAW-01",
        issuing_bank="Test Bank",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add(instrument)
    await db_session.flush()

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        req = await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=instrument.id,
            user=institution_user,
            data=ReleaseRequestCreate(reason="Test withdraw"),
        )
        # Move to UNDER_REVIEW
        await ReleaseService.start_review(db_session, req.id, officer_user)

        # Attempting withdrawal while UNDER_REVIEW raises 409
        with pytest.raises(HTTPException) as exc:
            await ReleaseService.withdraw_release_request(db_session, req.id, institution_user)
        assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_second_open_request_raises_conflict(
    db_session: AsyncSession,
    institution_user: User,
):
    """Submitting a second release request while one is open raises 409 Conflict."""
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=institution_user.institution_id,
        reference_number="FDR-DUP-REQ-01",
        issuing_bank="Test Bank",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add(instrument)
    await db_session.flush()

    with patch("app.services.audit_service.AuditService.record", new_callable=AsyncMock):
        await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=instrument.id,
            user=institution_user,
            data=ReleaseRequestCreate(reason="First request"),
        )

        with pytest.raises(HTTPException) as exc:
            await ReleaseService.create_release_request(
                session=db_session,
                instrument_id=instrument.id,
                user=institution_user,
                data=ReleaseRequestCreate(reason="Second request"),
            )
        assert exc.value.status_code == 409
