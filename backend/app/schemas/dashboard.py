"""Dashboard aggregate response schemas."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict


class SummaryStatusItem(BaseModel):
    count: int
    total_amount: str


class DashboardSummaryResponse(BaseModel):
    active: SummaryStatusItem
    expiring: SummaryStatusItem
    matured: SummaryStatusItem
    renewed: SummaryStatusItem
    released: SummaryStatusItem
    release_requested: SummaryStatusItem
    pending: SummaryStatusItem
    verification_tag_split: dict[str, int]
    missing_documents_count: int
    unresolved_alerts_count: int
    escalation_level_1_count: int
    escalation_level_2_count: int


class MaturityBucketItem(BaseModel):
    month: str  # YYYY-MM
    count: int
    total_amount: str


class MaturityPipelineResponse(BaseModel):
    buckets: list[MaturityBucketItem]
    overdue: SummaryStatusItem


class GroupedStatusItem(BaseModel):
    group_key: str
    status: str
    count: int
    total_amount: str


class PendingItem(BaseModel):
    id: uuid.UUID
    reference_number: str
    institution_name: str
    status: str
    age_days: int


class PendingActionsResponse(BaseModel):
    pending_verifications: dict[str, int]
    pending_verifications_oldest: list[PendingItem]
    discrepancies_count: int
    discrepancies_oldest: list[PendingItem]
    releases_awaiting_review: int
    releases_awaiting_approval: int
    releases_oldest: list[PendingItem]


class ImpactMetricsResponse(BaseModel):
    avg_verification_turnaround_days: float | None = None
    median_verification_turnaround_days: float | None = None
    avg_release_turnaround_days: float | None = None
    renewals_before_maturity_pct: float | None = None
    alerts_auto_sent_count: int = 0
    alerts_auto_resolved_count: int = 0
    validation_flags_caught_count: int = 0
    discrepancies_found_count: int = 0
