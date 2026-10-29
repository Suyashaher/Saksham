"""Release request schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.db.enums import (
    ConditionResultEnum,
    OfficerRecommendation,
    ReleaseRequestStatus,
    ReleaseRequestType,
)


class BeneficiaryDetails(BaseModel):
    """Details of the beneficiary account for refunds."""

    account_holder_name: str
    account_number: str
    bank_name: str
    ifsc_code: str
    branch: str | None = None


class ReleaseRequestCreate(BaseModel):
    """Payload to submit a release or refund request."""

    request_type: ReleaseRequestType = ReleaseRequestType.RELEASE
    reason: str = Field(..., min_length=5)
    beneficiary_details: dict[str, Any] | None = None


class ConditionResultUpdateItem(BaseModel):
    condition_id: uuid.UUID
    result: ConditionResultEnum
    notes: str | None = None


class UpdateConditionsRequest(BaseModel):
    results: list[ConditionResultUpdateItem]


class RecommendationRequest(BaseModel):
    recommendation: OfficerRecommendation
    notes: str = Field(..., min_length=3)


class RejectionRequest(BaseModel):
    reason: str = Field(..., min_length=3)


class ConditionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    condition_id: uuid.UUID
    code: str
    description: str
    is_mandatory: bool
    is_auto: bool
    result: ConditionResultEnum
    checked_at: datetime
    checked_by_id: uuid.UUID | None = None
    notes: str | None = None


class TimelineEvent(BaseModel):
    timestamp: datetime
    event: str
    actor_email: str | None = None
    role: str | None = None
    notes: str | None = None


class ReleaseRequestListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    instrument_id: uuid.UUID
    request_type: ReleaseRequestType
    status: ReleaseRequestStatus
    reason: str
    requested_by: uuid.UUID | None = None
    decided_by: uuid.UUID | None = None
    recommended_by: uuid.UUID | None = None
    recommended_at: datetime | None = None
    officer_recommendation: OfficerRecommendation | None = None
    withdrawn_at: datetime | None = None
    closure_document_id: uuid.UUID | None = None
    created_at: datetime
    decided_at: datetime | None = None


class ReleaseRequestDetailResponse(ReleaseRequestListItem):
    officer_notes: str | None = None
    decision_notes: str | None = None
    beneficiary_details: dict[str, Any] | None = None
    condition_results: list[ConditionResultResponse] = []
    timeline: list[TimelineEvent] = []


class ReleaseRequestListResponse(BaseModel):
    items: list[ReleaseRequestListItem]
    total: int
    page: int
    page_size: int
