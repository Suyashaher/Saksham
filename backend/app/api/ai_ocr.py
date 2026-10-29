"""OCR API router — document extraction endpoints.

SECURITY: OCR output is untrusted input. Officers must confirm all values.
No extraction may modify instrument status or verification tag.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_session, require_roles
from app.db.enums import UserRole
from app.db.models.document import Document
from app.db.models.instrument import Instrument
from app.db.models.ai_models import OcrRun
from app.ai.ocr.extractor import TesseractOcrExtractor
from app.ai.ocr.engine import get_ocr_engine
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1/ai/ocr", tags=["AI OCR"])


# ── Response Schemas ─────────────────────────────────────────────────────────


class OcrFieldResponse(BaseModel):
    name: str
    value: str | None
    confidence: float


class OcrPreviewResponse(BaseModel):
    fields: dict[str, object]
    field_details: list[OcrFieldResponse]
    overall_confidence: float
    page_count: int
    duration_ms: int
    engine: str
    doc_type: str
    data_source: str = "n/a"


class OcrAttachResponse(BaseModel):
    fields: dict[str, object]
    field_details: list[OcrFieldResponse]
    overall_confidence: float
    mismatches: list[dict]
    mismatch_count: int
    page_count: int
    duration_ms: int
    engine: str
    doc_type: str


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/preview", response_model=OcrPreviewResponse)
async def ocr_preview(
    file: UploadFile = File(...),
    doc_type: str = Form("FDR_SCAN"),
    user=Depends(require_roles(
        UserRole.INSTITUTION, UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN
    )),
):
    """Preview mode: extract fields from an uploaded file without storing.

    The officer uses this to auto-fill the instrument form.
    Nothing is persisted — pure stateless extraction.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_OCR_ENABLED:
        raise HTTPException(status_code=503, detail="OCR feature is disabled")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty")

    if len(file_bytes) > settings.OCR_SYNC_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large for sync OCR (max {settings.OCR_SYNC_MAX_SIZE_MB}MB)",
        )

    engine = get_ocr_engine(settings.TESSERACT_CMD)
    extractor = TesseractOcrExtractor(engine=engine, languages=settings.OCR_LANGUAGES)

    if not extractor.is_available:
        raise HTTPException(
            status_code=503,
            detail="OCR engine is not available. Please enter values manually.",
        )

    result = extractor.extract_with_profile(
        file_bytes, file.content_type or "application/pdf", doc_type
    )

    return OcrPreviewResponse(
        fields={k: str(v) for k, v in result.fields.items()},
        field_details=[
            OcrFieldResponse(name=fr.name, value=str(fr.value) if fr.value else None, confidence=fr.confidence)
            for fr in result.field_results
        ],
        overall_confidence=result.overall_confidence,
        page_count=result.page_count,
        duration_ms=result.duration_ms,
        engine=result.engine,
        doc_type=result.doc_type,
    )


@router.post("/extract/{document_id}", response_model=OcrAttachResponse)
async def ocr_extract_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN)),
):
    """Attach mode: run OCR on an already-uploaded document and cross-check
    extracted values against the instrument's declared values.

    Mismatches are recorded as WARNING validation flags on the instrument.
    An OcrRun metadata record is created (no extracted text stored).
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_OCR_ENABLED:
        raise HTTPException(status_code=503, detail="OCR feature is disabled")

    # Load document + instrument
    result = await session.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    inst_result = await session.execute(
        select(Instrument).where(Instrument.id == document.instrument_id)
    )
    instrument = inst_result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    # Download and decrypt the document
    from app.services.document_service import DocumentService

    doc_service = DocumentService(settings)
    file_bytes, _filename = await doc_service.download(session, document)

    engine = get_ocr_engine(settings.TESSERACT_CMD)
    extractor = TesseractOcrExtractor(engine=engine, languages=settings.OCR_LANGUAGES)

    if not extractor.is_available:
        raise HTTPException(
            status_code=503,
            detail="OCR engine is not available",
        )

    # Build declared values from the instrument
    declared = {
        "reference_number": instrument.reference_number,
        "issuing_bank": instrument.issuing_bank,
        "amount": str(instrument.amount),
        "issue_date": instrument.issue_date.isoformat() if instrument.issue_date else None,
        "maturity_date": instrument.maturity_date.isoformat() if instrument.maturity_date else None,
    }

    # Determine content type from doc_type or filename
    content_type = "application/pdf"  # default
    if document.file_name:
        lower_name = document.file_name.lower()
        if lower_name.endswith(".jpg") or lower_name.endswith(".jpeg"):
            content_type = "image/jpeg"
        elif lower_name.endswith(".png"):
            content_type = "image/png"

    extraction = extractor.extract_and_compare(
        file_bytes, content_type, declared, doc_type=document.doc_type
    )

    # Record OCR run metadata (NO extracted text)
    ocr_run = OcrRun(
        document_id=document.id,
        instrument_id=instrument.id,
        doc_type=document.doc_type,
        engine=extraction.engine,
        engine_version=extraction.engine_version,
        languages=settings.OCR_LANGUAGES,
        duration_ms=extraction.duration_ms,
        page_count=extraction.page_count,
        per_field_confidence={
            fr.name: fr.confidence for fr in extraction.field_results
        },
        overall_confidence=extraction.overall_confidence,
        mismatch_count=len(extraction.mismatches),
    )
    session.add(ocr_run)

    # Store mismatches as WARNING validation flags
    if extraction.mismatches:
        existing_flags = instrument.validation_flags or []
        for mismatch in extraction.mismatches:
            existing_flags.append({
                "field": mismatch.field,
                "code": mismatch.code,
                "message": mismatch.message,
                "severity": "WARNING",
                "source": "ocr",
            })
        instrument.validation_flags = existing_flags

    # Audit (redacted — no extracted text in payload)
    await AuditService.record(
        session,
        actor_id=user.id,
        action="ocr_extraction",
        entity_type="document",
        entity_id=document.id,
        payload={
            "instrument_id": str(instrument.id),
            "doc_type": document.doc_type,
            "overall_confidence": extraction.overall_confidence,
            "mismatch_count": len(extraction.mismatches),
            "engine": extraction.engine,
        },
    )

    await session.commit()

    return OcrAttachResponse(
        fields={k: str(v) for k, v in extraction.fields.items()},
        field_details=[
            OcrFieldResponse(name=fr.name, value=str(fr.value) if fr.value else None, confidence=fr.confidence)
            for fr in extraction.field_results
        ],
        overall_confidence=extraction.overall_confidence,
        mismatches=[
            {"field": m.field, "code": m.code, "message": m.message, "severity": m.severity}
            for m in extraction.mismatches
        ],
        mismatch_count=len(extraction.mismatches),
        page_count=extraction.page_count,
        duration_ms=extraction.duration_ms,
        engine=extraction.engine,
        doc_type=extraction.doc_type,
    )


@router.get("/runs/{instrument_id}")
async def get_ocr_runs(
    instrument_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
):
    """Retrieve historical OCR run metadata for an instrument."""
    stmt = (
        select(OcrRun)
        .where(OcrRun.instrument_id == instrument_id)
        .order_by(OcrRun.created_at.desc())
    )
    result = await session.execute(stmt)
    runs = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "document_id": str(r.document_id),
            "instrument_id": str(r.instrument_id),
            "doc_type": r.doc_type,
            "engine": r.engine,
            "engine_version": r.engine_version,
            "duration_ms": r.duration_ms,
            "page_count": r.page_count,
            "overall_confidence": r.overall_confidence,
            "per_field_confidence": r.per_field_confidence,
            "mismatch_count": r.mismatch_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]
