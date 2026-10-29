"""Release request lifecycle endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.dependencies import get_current_user, require_roles
from app.db.enums import ReleaseRequestStatus, ReleaseRequestType, UserRole
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.release import (
    RecommendationRequest,
    RejectionRequest,
    ReleaseRequestCreate,
    ReleaseRequestDetailResponse,
    ReleaseRequestListItem,
    ReleaseRequestListResponse,
    UpdateConditionsRequest,
)
from app.services.document_service import DocumentService
from app.services.release_service import ReleaseService

router = APIRouter(tags=["releases"])


def get_doc_service() -> DocumentService:
    settings = get_settings()
    return DocumentService(settings)


@router.post(
    "/instruments/{instrument_id}/release-requests",
    response_model=ReleaseRequestListItem,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.INSTITUTION))],
)
async def submit_release_request(
    instrument_id: uuid.UUID,
    data: ReleaseRequestCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Submit a release or refund request for an owned instrument."""
    req = await ReleaseService.create_release_request(
        session=session,
        instrument_id=instrument_id,
        user=current_user,
        data=data,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/withdraw",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.INSTITUTION))],
)
async def withdraw_release_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Withdraw a pending release request."""
    req = await ReleaseService.withdraw_release_request(
        session=session,
        request_id=request_id,
        user=current_user,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/start-review",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.VERIFYING_OFFICER, UserRole.ADMIN))],
)
async def start_review(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Move a pending request to UNDER_REVIEW."""
    req = await ReleaseService.start_review(
        session=session,
        request_id=request_id,
        user=current_user,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/conditions",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.VERIFYING_OFFICER, UserRole.ADMIN))],
)
async def update_conditions(
    request_id: uuid.UUID,
    data: UpdateConditionsRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Record manual condition results and re-evaluate automatic conditions."""
    req = await ReleaseService.record_conditions(
        session=session,
        request_id=request_id,
        user=current_user,
        results_update=data.results,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/recommend",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.VERIFYING_OFFICER))],
)
async def recommend_release(
    request_id: uuid.UUID,
    data: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Submit an officer recommendation for release/refund."""
    req = await ReleaseService.recommend(
        session=session,
        request_id=request_id,
        user=current_user,
        data=data,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/approve",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.APPROVING_AUTHORITY))],
)
async def approve_release(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    doc_service: DocumentService = Depends(get_doc_service),
):
    """Approve a release request, generating the closure certificate atomically."""
    req = await ReleaseService.approve(
        session=session,
        request_id=request_id,
        user=current_user,
        document_service=doc_service,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.post(
    "/release-requests/{request_id}/reject",
    response_model=ReleaseRequestListItem,
    dependencies=[Depends(require_roles(UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY))],
)
async def reject_release(
    request_id: uuid.UUID,
    data: RejectionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Reject a release request with mandatory reason."""
    req = await ReleaseService.reject(
        session=session,
        request_id=request_id,
        user=current_user,
        data=data,
    )
    await session.commit()
    await session.refresh(req)
    return req


@router.get(
    "/release-requests",
    response_model=ReleaseRequestListResponse,
)
async def list_release_requests(
    status: ReleaseRequestStatus | None = None,
    request_type: ReleaseRequestType | None = None,
    institution_id: uuid.UUID | None = None,
    instrument_id: uuid.UUID | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List release requests with role-based scoping."""
    query = (
        select(ReleaseRequest)
        .join(Instrument, ReleaseRequest.instrument_id == Instrument.id)
        .order_by(ReleaseRequest.created_at.desc())
    )

    if current_user.role == UserRole.INSTITUTION:
        query = query.where(Instrument.institution_id == current_user.institution_id)
    elif institution_id:
        query = query.where(Instrument.institution_id == institution_id)

    if instrument_id:
        query = query.where(ReleaseRequest.instrument_id == instrument_id)

    if status:
        query = query.where(ReleaseRequest.status == status)
    if request_type:
        query = query.where(ReleaseRequest.request_type == request_type)

    # Total count
    count_stmt = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    items = (await session.execute(query)).scalars().all()

    return ReleaseRequestListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/release-requests/{request_id}",
    response_model=ReleaseRequestDetailResponse,
)
async def get_release_request(
    request_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Fetch complete release request detail with masked beneficiary and conditions."""
    return await ReleaseService.get_request_detail(
        session=session,
        request_id=request_id,
        user=current_user,
    )
