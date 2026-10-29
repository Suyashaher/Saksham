"""Instrument management and scrutiny API router."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, require_roles
from app.db.enums import FDRStatus, UserRole, VerificationMethod, VerificationTag
from app.db.models.instrument import Instrument
from app.services.instrument_filters import InstrumentFilter, build_query
from app.db.models.observation import ScrutinyObservation
from app.db.models.user import User
from app.db.models.verification import VerificationRecord
from app.db.session import get_session
from app.schemas.instrument import (
    DiscrepancyRequest,
    InstrumentCreate,
    InstrumentCreateResponse,
    InstrumentLineageResponse,
    InstrumentListItem,
    InstrumentListResponse,
    InstrumentResponse,
    InstrumentUpdate,
    MarkVerifiedRequest,
    ObservationCreate,
    ObservationResponse,
    RenewalInitiateRequest,
    ValidationIssueSchema,
)
from app.schemas.verification import BankVerifyResponse
from app.services.audit_service import AuditService
from app.services.bank_verifier import get_bank_verifier
from app.services.escalation import auto_resolve_alerts
from app.services.instrument_service import InstrumentService
from app.services.instrument_state import IllegalTransitionError, transition
from app.services.renewal_service import complete_renewal, get_lineage, initiate_renewal
from app.services.validation import validate_instrument

router = APIRouter(prefix="/instruments", tags=["instruments"])


@router.post("/", response_model=InstrumentCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_instrument(
    body: InstrumentCreate,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION)),
    session: AsyncSession = Depends(get_session),
) -> InstrumentCreateResponse:
    """Submit a new FDR instrument (INSTITUTION only)."""
    if current_user.institution_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not linked to an institution",
        )

    try:
        instrument = await InstrumentService.create(session, body.model_dump(), current_user)
        await session.commit()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.args[0],
        )

    warnings: list[ValidationIssueSchema] = []
    if instrument.validation_flags:
        warnings = [ValidationIssueSchema(**w) for w in instrument.validation_flags]

    return InstrumentCreateResponse(
        instrument=InstrumentListItem.model_validate(instrument),
        warnings=warnings,
    )


@router.get("/queue", response_model=InstrumentListResponse)
async def get_scrutiny_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> InstrumentListResponse:
    """Scrutiny queue for officers (unassigned SUBMITTED + assigned UNDER_SCRUTINY)."""
    items, total = await InstrumentService.get_queue(
        session, current_user, page=page, page_size=page_size
    )
    return InstrumentListResponse(
        items=[InstrumentListItem.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/", response_model=InstrumentListResponse)
async def list_instruments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: FDRStatus | None = Query(None, alias="status"),
    bank: str | None = None,
    institution_id: UUID | None = None,
    maturity_from: date | None = None,
    maturity_to: date | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InstrumentListResponse:
    """List instruments (all roles, auto-scoped for INSTITUTION)."""
    items, total = await InstrumentService.list_instruments(
        session,
        current_user,
        page=page,
        page_size=page_size,
        status=status_filter,
        bank=bank,
        institution_id=institution_id,
        maturity_from=maturity_from,
        maturity_to=maturity_to,
        search=search,
    )
    return InstrumentListResponse(
        items=[InstrumentListItem.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/search", response_model=InstrumentListResponse)
async def search_instruments(
    filter_params: InstrumentFilter,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InstrumentListResponse:
    """Advanced search across instruments using the shared filter layer.

    Used by the frontend and the Phase 7 natural-language search layer.
    """
    base_query = build_query(filter_params, current_user, include_relationships=False)
    count_stmt = select(func.count()).select_from(base_query.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    query = build_query(filter_params, current_user, include_relationships=True)
    offset = (filter_params.page - 1) * filter_params.page_size
    query = query.offset(offset).limit(filter_params.page_size)
    items = (await session.execute(query)).scalars().all()

    return InstrumentListResponse(
        items=[InstrumentListItem.model_validate(i) for i in items],
        total=total,
        page=filter_params.page,
        page_size=filter_params.page_size,
    )


@router.get("/{instrument_id}", response_model=InstrumentResponse)
async def get_instrument(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InstrumentResponse:
    """Get full details of an instrument including documents, verifications, observations, and history."""
    instrument = await InstrumentService.get_by_id(session, instrument_id, current_user)
    if instrument is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )
    return InstrumentResponse.model_validate(instrument)


@router.patch("/{instrument_id}", response_model=InstrumentListItem)
async def update_instrument(
    instrument_id: UUID,
    body: InstrumentUpdate,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION)),
    session: AsyncSession = Depends(get_session),
) -> InstrumentListItem:
    """Update an instrument (INSTITUTION only, while SUBMITTED or DISCREPANCY)."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None or instrument.institution_id != current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instrument not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    if "verification_tag" in update_data and (
        update_data["verification_tag"] == VerificationTag.BANK_VERIFIED.value
        or update_data["verification_tag"] == VerificationTag.BANK_VERIFIED
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot manually set verification_tag to BANK_VERIFIED",
        )

    try:
        updated = await InstrumentService.update(session, instrument, update_data, current_user)
        await session.commit()
    except ValueError as exc:
        msg = str(exc.args[0])
        if "cannot be edited" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        if "Cannot manually set verification_tag" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.args[0])

    return InstrumentListItem.model_validate(updated)


@router.post("/{instrument_id}/start-scrutiny")
async def start_scrutiny(
    instrument_id: UUID,
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Move instrument to UNDER_SCRUTINY and assign to current officer."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    try:
        await transition(session, instrument, FDRStatus.UNDER_SCRUTINY, current_user)
        instrument.assigned_officer_id = current_user.id
        await session.commit()
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {
        "status": FDRStatus.UNDER_SCRUTINY.value,
        "assigned_officer_id": str(current_user.id),
    }


@router.post(
    "/{instrument_id}/observations",
    response_model=ObservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_observation(
    instrument_id: UUID,
    body: ObservationCreate,
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> ObservationResponse:
    """Add a scrutiny observation to an instrument under scrutiny."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    if instrument.status != FDRStatus.UNDER_SCRUTINY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Observations can only be added while instrument is UNDER_SCRUTINY",
        )

    obs = ScrutinyObservation(
        instrument_id=instrument.id,
        observer_id=current_user.id,
        category=body.category,
        text=body.text,
        severity=body.severity,
    )
    session.add(obs)

    await AuditService.record(
        session,
        actor_id=current_user.id,
        action="add_observation",
        entity_type="instrument",
        entity_id=instrument.id,
        payload={
            "category": body.category,
            "severity": body.severity,
            "text": body.text,
        },
    )
    await session.commit()
    await session.refresh(obs)
    return ObservationResponse.model_validate(obs)


@router.post("/{instrument_id}/flag-discrepancy")
async def flag_discrepancy(
    instrument_id: UUID,
    body: DiscrepancyRequest,
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Move instrument to DISCREPANCY status."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    try:
        await transition(
            session,
            instrument,
            FDRStatus.DISCREPANCY,
            current_user,
            note=body.notes,
        )
        await session.commit()
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {"status": FDRStatus.DISCREPANCY.value}


@router.post("/{instrument_id}/mark-verified")
async def mark_verified(
    instrument_id: UUID,
    body: MarkVerifiedRequest | None = None,
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Move instrument from UNDER_SCRUTINY to VERIFIED, forwarding to Approver."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    note_text = body.notes if (body and body.notes) else "Verified by officer and forwarded to approving authority."
    try:
        # If instrument was SUBMITTED, auto-assign and progress through UNDER_SCRUTINY
        if instrument.status == FDRStatus.SUBMITTED:
            await transition(session, instrument, FDRStatus.UNDER_SCRUTINY, current_user)
            instrument.assigned_officer_id = current_user.id

        await transition(session, instrument, FDRStatus.VERIFIED, current_user, note=note_text)
        await session.commit()
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {
        "status": FDRStatus.VERIFIED.value,
        "message": "Instrument marked as VERIFIED and forwarded to Approving Authority.",
    }


@router.post("/{instrument_id}/activate")
async def activate_instrument(
    instrument_id: UUID,
    body: MarkVerifiedRequest | None = None,
    current_user: User = Depends(
        require_roles(UserRole.APPROVING_AUTHORITY, UserRole.ADMIN)
    ),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Activate an instrument (APPROVING_AUTHORITY or ADMIN only)."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    note_text = body.notes if (body and body.notes) else "Approved and activated by Approving Authority."
    try:
        await transition(session, instrument, FDRStatus.ACTIVE, current_user, note=note_text)
        # If this instrument is replacing an older instrument, complete renewal
        if instrument.replaces_instrument_id:
            await complete_renewal(session, instrument, current_user)
        # Auto-resolve open alerts
        await auto_resolve_alerts(session, instrument.id, "instrument_activated")
        await session.commit()
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {"status": FDRStatus.ACTIVE.value, "message": "Instrument successfully approved and activated."}


@router.post("/{instrument_id}/resubmit")
async def resubmit_instrument(
    instrument_id: UUID,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Resubmit an instrument from DISCREPANCY back to SUBMITTED after correction."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None or instrument.institution_id != current_user.institution_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    try:
        await transition(
            session,
            instrument,
            FDRStatus.SUBMITTED,
            current_user,
            note="Resubmitted after correction",
        )
        instrument.assigned_officer_id = None

        # Re-run validation
        data = {
            "reference_number": instrument.reference_number,
            "issuing_bank": instrument.issuing_bank,
            "amount": instrument.amount,
            "issue_date": instrument.issue_date,
            "maturity_date": instrument.maturity_date,
            "branch": instrument.branch,
            "required_amount": instrument.required_amount,
        }
        issues = await validate_instrument(session, data, instrument_id=instrument.id)
        errors = [i for i in issues if i.severity == "ERROR"]
        if errors:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[{"field": i.field, "code": i.code, "message": i.message} for i in errors],
            )
        warnings = [i for i in issues if i.severity == "WARNING"]
        instrument.validation_flags = (
            [{"field": w.field, "code": w.code, "message": w.message} for w in warnings]
            if warnings
            else None
        )

        await session.commit()
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    return {
        "status": FDRStatus.SUBMITTED.value,
        "warnings": instrument.validation_flags or [],
    }


@router.post("/{instrument_id}/verify", response_model=BankVerifyResponse)
async def verify_with_bank(
    instrument_id: UUID,
    current_user: User = Depends(
        require_roles(
            UserRole.VERIFYING_OFFICER,
            UserRole.APPROVING_AUTHORITY,
            UserRole.ADMIN,
        )
    ),
    session: AsyncSession = Depends(get_session),
) -> BankVerifyResponse:
    """Verify instrument against bank registry (must be UNDER_SCRUTINY)."""
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    instrument = res.scalar_one_or_none()
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    if instrument.status != FDRStatus.UNDER_SCRUTINY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Verification can only be performed while instrument is UNDER_SCRUTINY",
        )

    settings = get_settings()
    verifier = get_bank_verifier(settings)
    verify_result = await verifier.verify(
        session,
        reference_number=instrument.reference_number,
        issuing_bank=instrument.issuing_bank,
        amount=instrument.amount,
        issue_date=instrument.issue_date,
        maturity_date=instrument.maturity_date,
    )

    record = VerificationRecord(
        instrument_id=instrument.id,
        method=VerificationMethod.API,
        result=json.dumps(verify_result.raw_response) if verify_result.raw_response else "NOT_FOUND",
        verified_by=current_user.id,
        verified_at=datetime.now(timezone.utc),
        discrepancy_notes=json.dumps(verify_result.mismatches) if verify_result.mismatches else None,
    )
    session.add(record)

    if verify_result.matches:
        instrument.verification_tag = VerificationTag.BANK_VERIFIED

    await AuditService.record(
        session,
        actor_id=current_user.id,
        action="bank_verification",
        entity_type="instrument",
        entity_id=instrument.id,
        payload={
            "found": verify_result.found,
            "matches": verify_result.matches,
            "mismatches": verify_result.mismatches,
        },
    )

    await session.commit()
    await session.refresh(record)

    return BankVerifyResponse(
        found=verify_result.found,
        matches=verify_result.matches,
        mismatches=verify_result.mismatches,
        verification_record_id=record.id,
    )


@router.post("/{instrument_id}/renew", response_model=InstrumentListItem, status_code=status.HTTP_201_CREATED)
async def renew_instrument(
    instrument_id: UUID,
    body: RenewalInitiateRequest | None = None,
    current_user: User = Depends(require_roles(UserRole.INSTITUTION)),
    session: AsyncSession = Depends(get_session),
) -> Instrument:
    """Initiate renewal for an existing instrument (INSTITUTION only)."""
    ref_num = body.reference_number if body else None
    amt = body.amount if body else None
    mat_date = body.maturity_date if body else None

    new_inst = await initiate_renewal(
        session,
        old_instrument_id=instrument_id,
        actor=current_user,
        reference_number=ref_num,
        amount=amt,
        maturity_date=mat_date,
    )
    await session.commit()
    await session.refresh(new_inst)
    return new_inst


@router.get("/{instrument_id}/lineage", response_model=InstrumentLineageResponse)
async def get_instrument_lineage(
    instrument_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get the complete renewal history and lineage tree for an instrument."""
    # Institutional scoping
    res = await session.execute(select(Instrument).where(Instrument.id == instrument_id))
    inst = res.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    if current_user.role == UserRole.INSTITUTION:
        if inst.institution_id != current_user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    return await get_lineage(session, instrument_id)

