"""Phase 5: Atomicity tests for approval and closure certificate generation."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import (
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
from app.db.models.user import User
from app.services.release_service import ReleaseService


@pytest.mark.asyncio
async def test_failure_during_closure_generation_rolls_back_everything(db_session: AsyncSession):
    """If closure PDF generation or storage fails, the entire transaction rolls back."""
    inst_id = uuid.uuid4()
    institution = Institution(
        id=inst_id,
        name="Atomicity Test College",
        aicte_id="AICTE-ATOM-01",
        state="Delhi",
        contact_email="atom@aicte.ac.in",
    )
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=inst_id,
        reference_number="FDR-ATOM-01",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=date(2024, 1, 1),
        maturity_date=date(2027, 1, 1),
        status=FDRStatus.RELEASE_REQUESTED,
        status_before_release_request="ACTIVE",
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    officer = User(
        id=uuid.uuid4(),
        email="officer@aicte.gov.in",
        role=UserRole.VERIFYING_OFFICER,
        is_active=True,
    )
    approver = User(
        id=uuid.uuid4(),
        email="approver@aicte.gov.in",
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )
    req = ReleaseRequest(
        id=uuid.uuid4(),
        instrument_id=instrument.id,
        request_type=ReleaseRequestType.RELEASE,
        reason="Atomic test release",
        status=ReleaseRequestStatus.UNDER_REVIEW,
        recommended_by=officer.id,
        recommended_at=date(2026, 1, 1),
        officer_recommendation=OfficerRecommendation.RECOMMEND,
    )

    db_session.add_all([institution, instrument, officer, approver, req])
    await db_session.flush()

    # Mock document service that fails during upload (e.g. MinIO network error)
    mock_doc_service = AsyncMock()
    mock_doc_service.upload.side_effect = RuntimeError("MinIO connection failed during closure upload")

    with patch("app.services.release_conditions.validate_mandatory_conditions", return_value=(True, [])):
        with pytest.raises(RuntimeError) as exc:
            await ReleaseService.approve(
                session=db_session,
                request_id=req.id,
                user=approver,
                document_service=mock_doc_service,
            )

    assert "MinIO connection failed" in str(exc.value)

    # Rollback session as endpoint error handler would
    await db_session.rollback()

    # Verify atomic guarantees:
    # 1. Instrument was NOT transitioned to RELEASED
    reloaded_inst = (await db_session.execute(select(Instrument).where(Instrument.id == instrument.id))).scalars().first()
    assert reloaded_inst.status == FDRStatus.RELEASE_REQUESTED

    # 2. Release request remains UNDER_REVIEW
    reloaded_req = (await db_session.execute(select(ReleaseRequest).where(ReleaseRequest.id == req.id))).scalars().first()
    assert reloaded_req.status == ReleaseRequestStatus.UNDER_REVIEW
    assert reloaded_req.closure_document_id is None

    # 3. No orphan document was created
    doc_count = (await db_session.execute(select(Document).where(Document.instrument_id == instrument.id))).scalars().all()
    assert len(doc_count) == 0
