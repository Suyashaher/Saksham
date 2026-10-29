"""Closure certificate verification endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.enums import UserRole
from app.db.models.document import Document
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.user import User
from app.db.session import get_session
from app.services.closure_service import ClosureService

router = APIRouter(prefix="/closure", tags=["closure"])


@router.get("/verify/{closure_reference}")
async def verify_closure_certificate(
    closure_reference: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Authenticate and verify a release/discharge certificate by reference number.

    Institution users are scoped to their own instruments.
    """
    doc_stmt = (
        select(Document)
        .where(Document.file_name == f"{closure_reference}.pdf")
        .options(selectinload(Document.instrument).selectinload(Instrument.institution))
    )
    doc = (await session.execute(doc_stmt)).scalars().first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure certificate '{closure_reference}' not found",
        )

    instrument = doc.instrument
    institution = instrument.institution

    # Scoping check: institution users can only verify their own instruments
    if current_user.role == UserRole.INSTITUTION and instrument.institution_id != current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Closure certificate '{closure_reference}' not found",
        )

    # Find the release request
    req_stmt = select(ReleaseRequest).where(ReleaseRequest.closure_document_id == doc.id)
    release_req = (await session.execute(req_stmt)).scalars().first()
    if not release_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Release request record associated with this certificate was not found",
        )

    expected_code = ClosureService.compute_verification_code(
        closure_reference=closure_reference,
        instrument_id=instrument.id,
        request_id=release_req.id,
        approver_id=release_req.decided_by or current_user.id,
        approved_at=release_req.decided_at or release_req.created_at,
    )

    return {
        "valid": True,
        "closure_reference": closure_reference,
        "instrument_id": str(instrument.id),
        "reference_number": instrument.reference_number,
        "institution_id": str(institution.id),
        "institution_name": institution.name,
        "aicte_id": institution.aicte_id,
        "issuing_bank": instrument.issuing_bank,
        "amount": str(instrument.amount),
        "status": instrument.status.value,
        "approved_at": release_req.decided_at.isoformat() if release_req.decided_at else None,
        "verification_code": expected_code,
    }
