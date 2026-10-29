"""Pydantic schemas for audit log endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    actor_id: UUID | None = None
    actor_name: str | None = None
    actor_role: str | None = None
    action: str
    entity_type: str
    entity_id: UUID
    payload: dict | None = None
    created_at: datetime
    prev_hash: str | None = None
    hash: str | None = None
    current_hash: str | None = None

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


class ChainVerifyResponse(BaseModel):
    valid: bool
    checked: int
    total_checked: int = 0
    first_broken_id: UUID | None = None
    head_hash: str | None = None
