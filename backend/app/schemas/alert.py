"""Pydantic schemas for Alert endpoints."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import AlertStatus


class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    instrument_id: uuid.UUID
    rule_id: uuid.UUID | None = None
    rule_name: str
    recipient_user_id: uuid.UUID
    channel: str
    scheduled_for: date | None = None
    scheduled_at: datetime
    sent_at: datetime | None = None
    escalation_level: int
    status: AlertStatus
    failure_count: int
    last_error: str | None = None
    acknowledged_by: uuid.UUID | None = None
    acknowledged_at: datetime | None = None
    resolved: bool
    resolved_at: datetime | None = None
    resolved_reason: str | None = None
    parent_alert_id: uuid.UUID | None = None


class AlertResolveRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for resolving the alert")
