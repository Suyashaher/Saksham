"""Pydantic schemas for document management."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    instrument_id: UUID
    doc_type: str
    file_name: str
    sha256: str
    version: int
    uploaded_by: UUID | None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
