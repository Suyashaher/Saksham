"""Audit log API router."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.db.enums import UserRole
from app.db.session import get_session
from app.schemas.audit import AuditLogListResponse, AuditLogResponse, ChainVerifyResponse
from app.services.audit_service import AuditService

router = APIRouter(tags=["audit"])


@router.get(
    "/audit/logs",
    response_model=AuditLogListResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.VERIFYING_OFFICER))],
)
@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.VERIFYING_OFFICER))],
)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    session: AsyncSession = Depends(get_session),
):
    rows, total = await AuditService.list_logs(
        session,
        page=page,
        page_size=page_size,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    items = [
        AuditLogResponse(
            id=entry.id,
            user_id=entry.user_id,
            actor_id=entry.user_id,
            actor_name=full_name,
            actor_role=role.value if hasattr(role, "value") else str(role) if role else None,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            payload=entry.payload,
            created_at=entry.created_at,
            prev_hash=entry.prev_hash,
            hash=entry.hash,
            current_hash=entry.hash,
        )
        for entry, full_name, role in rows
    ]
    return AuditLogListResponse(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/audit/verify-chain",
    response_model=ChainVerifyResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
@router.get(
    "/audit-logs/verify",
    response_model=ChainVerifyResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
@router.get(
    "/audit-logs/verify-chain",
    response_model=ChainVerifyResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
async def verify_chain(session: AsyncSession = Depends(get_session)):
    result = await AuditService.verify_chain(session)
    return ChainVerifyResponse(
        valid=result["valid"],
        checked=result["checked"],
        total_checked=result.get("total_checked", result["checked"]),
        head_hash=result.get("head_hash"),
        first_broken_id=result["first_broken_id"],
    )
