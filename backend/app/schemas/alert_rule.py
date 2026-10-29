"""Pydantic schemas for AlertRule endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import AlertRuleType, UserRole


class AlertRuleBase(BaseModel):
    name: str = Field(..., max_length=255)
    rule_type: AlertRuleType
    days: int = Field(..., ge=0, description="Days before maturity or days in status")
    channels: list[str] = Field(default_factory=list, description="List of channels: EMAIL, SMS, IN_APP")
    recipient_role: UserRole
    escalate_after_days: int | None = Field(None, ge=1)
    is_active: bool = True


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRuleUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    rule_type: AlertRuleType | None = None
    days: int | None = Field(None, ge=0)
    channels: list[str] | None = None
    recipient_role: UserRole | None = None
    escalate_after_days: int | None = None
    is_active: bool | None = None


class AlertRuleRead(AlertRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
