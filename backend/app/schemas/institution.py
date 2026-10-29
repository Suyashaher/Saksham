"""Pydantic schemas for institution management."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class CreateInstitutionRequest(BaseModel):
    name: str
    aicte_id: str
    state: str
    contact_email: EmailStr
    contact_phone: str | None = None
    approval_cycle: str | None = None
    city: str | None = None
    address: str | None = None


class InstitutionResponse(BaseModel):
    id: UUID
    name: str
    aicte_id: str
    state: str
    contact_email: str
    contact_phone: str | None = None
    approval_cycle: str | None = None
    city: str | None = None
    address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InstitutionListResponse(BaseModel):
    items: list[InstitutionResponse]
    total: int
    page: int
    page_size: int
