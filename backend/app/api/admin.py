"""Admin management API router (Users, Institutions & Release Conditions)."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import require_roles
from app.db.enums import UserRole
from app.db.models.release_condition import ReleaseCondition
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.institution import (
    CreateInstitutionRequest,
    InstitutionListResponse,
    InstitutionResponse,
)
from app.schemas.release_condition import (
    ReleaseConditionCreate,
    ReleaseConditionResponse,
    ReleaseConditionUpdate,
)
from app.schemas.user import (
    CreateUserRequest,
    UpdateUserRequest,
    UserListResponse,
    UserResponse,
)
from app.services.audit_service import AuditService
from app.services.institution_service import InstitutionService
from app.services.monitoring import run_daily_scan
from app.services.user_service import UserService

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


# ── Users ───────────────────────────────────────────────────────────────────

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    try:
        user = await UserService.create_user(session, body, actor_id=admin.id)
        return UserResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            full_name=user.full_name,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            institution_id=user.institution_id,
            is_active=user.is_active,
            created_at=user.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: UserRole | None = None,
    institution_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    users, total = await UserService.list_users(
        session,
        page=page,
        page_size=page_size,
        role=role,
        institution_id=institution_id,
        is_active=is_active,
        search=search,
    )
    items = [
        UserResponse(
            id=u.id,
            email=u.email,
            phone=u.phone,
            full_name=u.full_name,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            institution_id=u.institution_id,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]
    return UserListResponse(items=items, total=total, page=page, page_size=page_size)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    try:
        user = await UserService.update_user(session, user_id, body, actor_id=admin.id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return UserResponse(
            id=user.id,
            email=user.email,
            phone=user.phone,
            full_name=user.full_name,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            institution_id=user.institution_id,
            is_active=user.is_active,
            created_at=user.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── Institutions ────────────────────────────────────────────────────────────

@router.post(
    "/institutions",
    response_model=InstitutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_institution(
    body: CreateInstitutionRequest,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    try:
        inst = await InstitutionService.create_institution(session, body, actor_id=admin.id)
        return InstitutionResponse(
            id=inst.id,
            name=inst.name,
            aicte_id=inst.aicte_id,
            state=inst.state,
            contact_email=inst.contact_email,
            contact_phone=inst.contact_phone,
            approval_cycle=inst.approval_cycle,
            created_at=inst.created_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/institutions", response_model=InstitutionListResponse)
async def list_institutions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    state: str | None = None,
    search: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    institutions, total = await InstitutionService.list_institutions(
        session, page=page, page_size=page_size, state=state, search=search
    )
    items = [
        InstitutionResponse(
            id=i.id,
            name=i.name,
            aicte_id=i.aicte_id,
            state=i.state,
            contact_email=i.contact_email,
            contact_phone=i.contact_phone,
            approval_cycle=i.approval_cycle,
            created_at=i.created_at,
        )
        for i in institutions
    ]
    return InstitutionListResponse(items=items, total=total, page=page, page_size=page_size)


# ── Release Conditions Management ───────────────────────────────────────────

@router.get("/release-conditions", response_model=list[ReleaseConditionResponse])
async def list_release_conditions(
    session: AsyncSession = Depends(get_session),
):
    """List all release conditions (ADMIN only)."""
    stmt = select(ReleaseCondition).order_by(ReleaseCondition.code.asc())
    conditions = (await session.execute(stmt)).scalars().all()
    return conditions


@router.post(
    "/release-conditions",
    response_model=ReleaseConditionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_release_condition(
    body: ReleaseConditionCreate,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    """Create a new release condition (ADMIN only, audited)."""
    # Check duplicate code
    existing_stmt = select(ReleaseCondition).where(ReleaseCondition.code == body.code)
    existing = (await session.execute(existing_stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Condition with code '{body.code}' already exists",
        )

    condition = ReleaseCondition(
        code=body.code,
        description=body.description,
        is_mandatory=body.is_mandatory,
        is_automatic=body.is_automatic,
        is_active=body.is_active,
        applies_to_request_type=body.applies_to_request_type,
    )
    session.add(condition)
    await session.flush()

    await AuditService.record(
        session=session,
        actor_id=admin.id,
        action="release_condition_created",
        entity_type="release_condition",
        entity_id=condition.id,
        payload=body.model_dump(),
    )
    await session.commit()
    await session.refresh(condition)
    return condition


@router.patch("/release-conditions/{condition_id}", response_model=ReleaseConditionResponse)
async def update_release_condition(
    condition_id: uuid.UUID,
    body: ReleaseConditionUpdate,
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
):
    """Update a release condition (ADMIN only, audited)."""
    stmt = select(ReleaseCondition).where(ReleaseCondition.id == condition_id)
    condition = (await session.execute(stmt)).scalars().first()
    if not condition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release condition not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(condition, field, val)

    await AuditService.record(
        session=session,
        actor_id=admin.id,
        action="release_condition_updated",
        entity_type="release_condition",
        entity_id=condition.id,
        payload=update_data,
    )
    await session.commit()
    await session.refresh(condition)
    return condition


# ── Jobs ────────────────────────────────────────────────────────────────────

class DailyScanJobRequest(BaseModel):
    as_of: str | None = Field(None, description="ISO date YYYY-MM-DD (allowed only when DEMO_MODE=true)")
    dry_run: bool = Field(False, description="If true, compute transitions/alerts without persisting")


@router.post("/jobs/run-daily-scan")
async def trigger_daily_scan(
    body: DailyScanJobRequest = DailyScanJobRequest(),
    admin: User = Depends(require_roles(UserRole.ADMIN)),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Trigger the automated daily monitoring scan manually (ADMIN only)."""
    settings = get_settings()
    parsed_date: date | None = None

    if body.as_of:
        if not settings.DEMO_MODE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="as_of parameter is only allowed when DEMO_MODE=true",
            )
        try:
            parsed_date = date.fromisoformat(body.as_of)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid as_of date format. Expected YYYY-MM-DD",
            )

    result = await run_daily_scan(session, as_of=parsed_date, dry_run=body.dry_run)
    return result
