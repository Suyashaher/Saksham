"""Phase 5: Closure document generation and verification tests."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.security import create_access_token
from app.db.enums import (
    FDRStatus,
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
from app.services.closure_service import ClosureService


@pytest.mark.asyncio
async def test_closure_document_pdf_generation_and_hash():
    """Verify ReportLab PDF generation and deterministic SHA-256 calculation."""
    inst_id = uuid.uuid4()
    req_id = uuid.uuid4()
    approver_id = uuid.uuid4()
    now = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
    closure_ref = "AICTE-FDR-REL-2026-000001"

    code = ClosureService.compute_verification_code(
        closure_reference=closure_ref,
        instrument_id=inst_id,
        request_id=req_id,
        approver_id=approver_id,
        approved_at=now,
    )
    assert len(code) == 64  # SHA-256 hex string

    institution = Institution(
        id=uuid.uuid4(),
        name="Indian Institute of Technology",
        aicte_id="AICTE-IIT-01",
        state="Maharashtra",
        contact_email="director@iit.ac.in",
    )
    instrument = Instrument(
        id=inst_id,
        institution_id=institution.id,
        reference_number="FDR-IIT-2026-99",
        issuing_bank="State Bank of India",
        branch="Powai, Mumbai",
        amount=Decimal("5000000.00"),
        issue_date=date(2023, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.RELEASED,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    release_req = ReleaseRequest(
        id=req_id,
        instrument_id=inst_id,
        request_type=ReleaseRequestType.RELEASE,
        reason="Statutory period complete",
        status=ReleaseRequestStatus.CLOSED,
    )
    approver = User(
        id=approver_id,
        email="approver@aicte.gov.in",
        name="Dr. AICTE Approver",
        role=UserRole.APPROVING_AUTHORITY,
    )

    pdf_bytes = ClosureService._build_pdf(
        closure_reference=closure_ref,
        verification_code=code,
        instrument=instrument,
        release_request=release_req,
        institution=institution,
        approver=approver,
        approved_at=now,
        portal_url="http://localhost:8000",
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_closure_verification_endpoint(client: AsyncClient, db_session: AsyncSession):
    """Verify endpoint checks reference number and returns valid=True."""
    inst_id = uuid.uuid4()
    institution = Institution(
        id=inst_id,
        name="Verification Test Academy",
        aicte_id="AICTE-V-01",
        state="Karnataka",
        contact_email="v@aicte.ac.in",
    )
    instrument = Instrument(
        id=uuid.uuid4(),
        institution_id=inst_id,
        reference_number="FDR-V-01",
        issuing_bank="Canara Bank",
        branch="MG Road",
        amount=Decimal("2000000.00"),
        issue_date=date(2023, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.RELEASED,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    closure_ref = "AICTE-FDR-REL-2026-999999"
    doc = Document(
        id=uuid.uuid4(),
        instrument_id=instrument.id,
        doc_type="CLOSURE",
        storage_key=f"test/{closure_ref}.pdf",
        file_name=f"{closure_ref}.pdf",
        sha256="dummy_sha",
    )
    approver = User(
        id=uuid.uuid4(),
        email="appr@aicte.gov.in",
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )
    req = ReleaseRequest(
        id=uuid.uuid4(),
        instrument_id=instrument.id,
        request_type=ReleaseRequestType.RELEASE,
        reason="Completed obligations",
        status=ReleaseRequestStatus.CLOSED,
        closure_document_id=doc.id,
        decided_by=approver.id,
        decided_at=clock.now(),
    )

    db_session.add_all([institution, instrument, doc, approver, req])
    await db_session.commit()

    token = create_access_token(
        data={"sub": str(approver.id), "role": approver.role.value, "institution_id": None}
    )

    # 1. Valid reference
    resp = await client.get(
        f"/closure/verify/{closure_ref}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert data["closure_reference"] == closure_ref
    assert data["institution_name"] == institution.name
    assert "verification_code" in data

    # 2. Tampered reference returns 404
    resp_tampered = await client.get(
        "/closure/verify/AICTE-FDR-REL-2026-000000",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_tampered.status_code == 404
