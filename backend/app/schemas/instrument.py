"""Pydantic schemas for instrument management."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.document import DocumentResponse
from app.schemas.verification import VerificationResponse


class InstrumentCreate(BaseModel):
    reference_number: str
    issuing_bank: str
    branch: str | None = None
    amount: Decimal = Field(gt=0)
    required_amount: Decimal | None = None
    issue_date: date
    maturity_date: date
    instrument_type: str = "FDR"
    claim_expiry_date: date | None = None
    beneficiary_name: str | None = "AICTE"


class InstrumentUpdate(BaseModel):
    reference_number: str | None = None
    issuing_bank: str | None = None
    branch: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    required_amount: Decimal | None = None
    issue_date: date | None = None
    maturity_date: date | None = None
    verification_tag: str | None = None
    instrument_type: str | None = None
    claim_expiry_date: date | None = None
    beneficiary_name: str | None = None


class ValidationIssueSchema(BaseModel):
    field: str
    code: str
    message: str
    severity: str


class StatusHistoryResponse(BaseModel):
    id: UUID
    from_status: str | None = None
    to_status: str
    changed_by: UUID | None = None
    note: str | None = None
    changed_at: datetime

    model_config = {"from_attributes": True}


class ObservationCreate(BaseModel):
    category: str
    text: str
    severity: str = "INFO"


class ObservationResponse(BaseModel):
    id: UUID
    instrument_id: UUID
    observer_id: UUID | None = None
    category: str
    text: str
    severity: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DiscrepancyRequest(BaseModel):
    notes: str


class MarkVerifiedRequest(BaseModel):
    notes: str | None = None


class InstrumentListItem(BaseModel):
    id: UUID
    institution_id: UUID
    reference_number: str
    issuing_bank: str
    branch: str | None = None
    amount: Decimal
    required_amount: Decimal | None = None
    issue_date: date
    maturity_date: date
    status: str
    verification_tag: str
    instrument_type: str = "FDR"
    claim_expiry_date: date | None = None
    beneficiary_name: str | None = None
    assigned_officer_id: UUID | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class InstrumentResponse(InstrumentListItem):
    validation_flags: list[dict] | dict | None = None
    documents: list[DocumentResponse] = []
    verification_records: list[VerificationResponse] = []
    observations: list[ObservationResponse] = []
    status_history: list[StatusHistoryResponse] = []

    model_config = {"from_attributes": True}


class InstrumentListResponse(BaseModel):
    items: list[InstrumentListItem]
    total: int
    page: int
    page_size: int


class InstrumentCreateResponse(BaseModel):
    instrument: InstrumentListItem
    warnings: list[ValidationIssueSchema] = []


class RenewalInitiateRequest(BaseModel):
    reference_number: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    maturity_date: date | None = None


class LineageItem(BaseModel):
    id: UUID
    reference_number: str
    status: str
    amount: float
    issue_date: str
    maturity_date: str
    renewed_after_maturity: bool = False


class LineageTarget(BaseModel):
    id: UUID
    reference_number: str
    status: str
    amount: float
    issue_date: str
    maturity_date: str
    replaces_instrument_id: UUID | None = None


class InstrumentLineageResponse(BaseModel):
    target: LineageTarget
    ancestors: list[LineageItem]
    descendants: list[LineageItem]
    full_chain: list[dict]

