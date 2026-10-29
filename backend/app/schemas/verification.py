"""Pydantic schemas for verification records."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VerificationResponse(BaseModel):
    id: UUID
    instrument_id: UUID
    method: str
    result: str
    verified_by: UUID | None
    verified_at: datetime | None
    discrepancy_notes: str | None

    model_config = {"from_attributes": True}


class BankVerifyResponse(BaseModel):
    found: bool
    matches: bool
    mismatches: dict
    verification_record_id: UUID | None = None
