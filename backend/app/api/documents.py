"""Document upload and download API router."""

from __future__ import annotations

import io
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, require_roles
from app.db.enums import UserRole
from app.db.models.document import Document
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.document import DocumentListResponse, DocumentResponse
from app.services.document_service import DocumentService

router = APIRouter(prefix="/instruments/{instrument_id}/documents", tags=["documents"])


def _get_document_service() -> DocumentService:
    settings = get_settings()
    if not settings.DOCUMENT_ENCRYPTION_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document encryption is not configured",
        )
    return DocumentService(settings)


from app.core.document_registry import DocumentRegistry


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    instrument_id: UUID,
    file: UploadFile = File(...),
    doc_type: str = Form("FDR_SCAN"),
    current_user: User = Depends(
        require_roles(
            UserRole.INSTITUTION,
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> DocumentResponse:
    """Upload and encrypt an instrument document subject to role and status constraints."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    user_role_str = (
        current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    )
    if user_role_str == UserRole.INSTITUTION.value and instrument.institution_id != current_user.institution_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    # Map legacy aliases
    normalized_doc_type = doc_type
    if doc_type == "FDR_CERTIFICATE":
        normalized_doc_type = "FDR_SCAN"

    # Validate against central document registry
    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    istatus = (
        instrument.status.value if hasattr(instrument.status, "value") else str(instrument.status)
    )
    is_allowed, reason = DocumentRegistry.is_doc_type_allowed(
        instrument_type=itype,
        doc_type=normalized_doc_type,
        uploader_role=user_role_str,
        status=istatus,
    )
    if not is_allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    doc_service = _get_document_service()
    content = await file.read()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "uploaded_file"

    try:
        doc = await doc_service.upload(
            session=session,
            instrument_id=instrument.id,
            file_bytes=content,
            content_type=content_type,
            filename=filename,
            doc_type=normalized_doc_type,
            uploaded_by=current_user.id,
        )
        await session.commit()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return DocumentResponse.model_validate(doc)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DocumentListResponse:
    """List all documents attached to an instrument (scoped for INSTITUTION)."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    user_role_str = (
        current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    )
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    if (
        user_role_str == UserRole.INSTITUTION.value
        and instrument.institution_id != current_user.institution_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    docs_res = await session.execute(
        select(Document)
        .where(Document.instrument_id == instrument_id)
        .order_by(Document.uploaded_at.desc())
    )
    docs = docs_res.scalars().all()
    return DocumentListResponse(
        items=[DocumentResponse.model_validate(d) for d in docs],
        total=len(docs),
    )


@router.get("/{doc_id}/download")
async def download_document(
    instrument_id: UUID,
    doc_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Download and decrypt a document (scoped for INSTITUTION)."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    user_role_str = (
        current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    )
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    if (
        user_role_str == UserRole.INSTITUTION.value
        and instrument.institution_id != current_user.institution_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    doc_res = await session.execute(
        select(Document).where(
            Document.id == doc_id, Document.instrument_id == instrument_id
        )
    )
    doc = doc_res.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc_service = _get_document_service()
    try:
        plaintext, filename = await doc_service.download(session, doc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to decrypt document: {exc}",
        )

    # Infer media type for inline viewing in browser iframe/embed
    content_type = "application/octet-stream"
    lower_fn = (filename or "").lower()
    if lower_fn.endswith(".pdf"):
        content_type = "application/pdf"
    elif lower_fn.endswith(".png"):
        content_type = "image/png"
    elif lower_fn.endswith(".jpg") or lower_fn.endswith(".jpeg"):
        content_type = "image/jpeg"

    return StreamingResponse(
        io.BytesIO(plaintext),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
