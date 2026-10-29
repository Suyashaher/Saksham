"""Phase 5: Segregation of duties and RBAC tests for release/refund workflow."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import (
    FDRStatus,
    OfficerRecommendation,
    ReleaseRequestStatus,
    ReleaseRequestType,
    UserRole,
    VerificationTag,
)
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.user import User
from app.schemas.release import RecommendationRequest, RejectionRequest, ReleaseRequestCreate
from app.services.release_service import ReleaseService


@pytest.fixture
def test_setup():
    inst_id = uuid.uuid4()
    institution = Institution(
        id=inst_id,
        name="Security Test College",
        aicte_id="AICTE-SEC-01",
        state="Delhi",
        contact_email="sec@aicte.ac.in",
    )
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=inst_id,
        reference_number="FDR-SOD-01",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    user_inst = User(
        id=uuid.uuid4(),
        email="inst@sec.ac.in",
        role=UserRole.INSTITUTION,
        institution_id=inst_id,
        is_active=True,
    )
    other_inst_user = User(
        id=uuid.uuid4(),
        email="other@inst.ac.in",
        role=UserRole.INSTITUTION,
        institution_id=uuid.uuid4(),
        is_active=True,
    )
    officer = User(
        id=uuid.uuid4(),
        email="officer@aicte.gov.in",
        role=UserRole.VERIFYING_OFFICER,
        is_active=True,
    )
    admin = User(
        id=uuid.uuid4(),
        email="admin@aicte.gov.in",
        role=UserRole.ADMIN,
        is_active=True,
    )
    approver = User(
        id=uuid.uuid4(),
        email="approver@aicte.gov.in",
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )
    return {
        "institution": institution,
        "instrument": instrument,
        "user_inst": user_inst,
        "other_inst_user": other_inst_user,
        "officer": officer,
        "admin": admin,
        "approver": approver,
    }


@pytest.mark.asyncio
async def test_approver_cannot_be_recommender(db_session: AsyncSession, test_setup: dict):
    """If an Approving Authority user also submitted the officer recommendation, approval is rejected."""
    data = test_setup
    db_session.add_all([data["institution"], data["instrument"]])
    await db_session.flush()

    # Create request recommended by the SAME user who tries to approve
dual_role_user = User(
        id=uuid.uuid4(),
        email="dual@aicte.gov.in",
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )

    req = ReleaseRequest(
        id=uuid.uuid4(),
        instrument_id=data["instrument"].id,
        request_type=ReleaseRequestType.RELEASE,
        reason="Test segregation",
        status=ReleaseRequestStatus.UNDER_REVIEW,
        recommended_by=dual_role_user.id,
        recommended_at=date(2026, 1, 1),
        officer_recommendation=OfficerRecommendation.RECOMMEND,
    )
    db_session.add(req)
    await db_session.flush()

    mock_doc_service = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await ReleaseService.approve(
            session=db_session,
            request_id=req.id,
            user=dual_role_user,
            document_service=mock_doc_service,
        )

    assert exc.value.status_code == 403
    assert "Segregation of duties violation" in exc.value.detail


@pytest.mark.asyncio
async def test_admin_cannot_approve_or_reject(db_session: AsyncSession, test_setup: dict):
    """ADMIN role is strictly barred from approving or rejecting release requests."""
    data = test_setup
    db_session.add_all([data["institution"], data["instrument"]])
    await db_session.flush()

    req = ReleaseRequest(
        id=uuid.uuid4(),
        instrument_id=data["instrument"].id,
        request_type=ReleaseRequestType.RELEASE,
        reason="Test admin rejection",
        status=ReleaseRequestStatus.UNDER_REVIEW,
        recommended_by=data["officer"].id,
        recommended_at=date(2026, 1, 1),
    )
    db_session.add(req)
    await db_session.flush()

    mock_doc_service = AsyncMock()

    # Admin cannot approve
    with pytest.raises(HTTPException) as exc_app:
        await ReleaseService.approve(
            session=db_session,
            request_id=req.id,
            user=data["admin"],
            document_service=mock_doc_service,
        )
    assert exc_app.value.status_code == 403
    assert "ADMIN is barred" in exc_app.value.detail

    # Admin cannot reject
    with pytest.raises(HTTPException) as exc_rej:
        await ReleaseService.reject(
            session=db_session,
            request_id=req.id,
            user=data["admin"],
            data=RejectionRequest(reason="Admin attempt"),
        )
    assert exc_rej.value.status_code == 403
    assert "ADMIN is barred" in exc_rej.value.detail


@pytest.mark.asyncio
async def test_other_institution_gets_404(db_session: AsyncSession, test_setup: dict):
    """An institution user attempting to view or request release on another's instrument receives 404."""
    data = test_setup
    db_session.add_all([data["institution"], data["instrument"]])
    await db_session.flush()

    with pytest.raises(HTTPException) as exc:
        await ReleaseService.create_release_request(
            session=db_session,
            instrument_id=data["instrument"].id,
            user=data["other_inst_user"],
            data=ReleaseRequestCreate(reason="Unauthorized attempt"),
        )
    assert exc.value.status_code == 404
