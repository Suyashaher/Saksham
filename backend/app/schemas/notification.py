"""Pydantic schemas for Notification endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    alert_id: uuid.UUID | None = None
    title: str
    body: str
    message: str | None = None
    channel: str = "IN_APP"
    is_read: bool
    created_at: datetime
