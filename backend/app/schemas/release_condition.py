"""Release condition schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReleaseConditionBase(BaseModel):
    code: str = Field(..., max_length=100)
    description: str
    is_mandatory: bool = True
    is_automatic: bool = False
    is_active: bool = True
    applies_to_request_type: str | None = None


class ReleaseConditionCreate(ReleaseConditionBase):
    pass


class ReleaseConditionUpdate(BaseModel):
    description: str | None = None
    is_mandatory: bool | None = None
    is_active: bool | None = None
    applies_to_request_type: str | None = None


class ReleaseConditionResponse(ReleaseConditionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
