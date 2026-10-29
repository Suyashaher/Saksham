"""Dashboard analytics endpoints."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, require_roles
from app.db.enums import UserRole
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    GroupedStatusItem,
    ImpactMetricsResponse,
    MaturityPipelineResponse,
    PendingActionsResponse,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    institution_id: uuid.UUID | None = None,
    state: str | None = None,
    bank: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve summarized instrument counts and amounts across statuses with Redis caching."""
    return await DashboardService.get_summary(
        session=session,
        user=current_user,
        institution_id=institution_id,
        state=state,
        bank=bank,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/maturity-pipeline", response_model=MaturityPipelineResponse)
async def get_maturity_pipeline(
    institution_id: uuid.UUID | None = None,
    state: str | None = None,
    bank: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve 12-month rolling maturity pipeline buckets and overdue count."""
    return await DashboardService.get_maturity_pipeline(
        session=session,
        user=current_user,
        institution_id=institution_id,
        state=state,
        bank=bank,
    )


@router.get("/by-bank", response_model=list[GroupedStatusItem])
async def get_instruments_by_bank(
    institution_id: uuid.UUID | None = None,
    state: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve instrument breakdown grouped by issuing bank and status."""
    return await DashboardService.get_by_bank(
        session=session,
        user=current_user,
        institution_id=institution_id,
        state=state,
    )


@router.get("/by-state", response_model=list[GroupedStatusItem])
async def get_instruments_by_state(
    bank: str | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve instrument breakdown grouped by institution state and status."""
    return await DashboardService.get_by_state(
        session=session,
        user=current_user,
        bank=bank,
    )


@router.get("/by-type", response_model=list[GroupedStatusItem])
async def get_instruments_by_type(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve instrument breakdown grouped by instrument type (FDR vs BANK_GUARANTEE) and status."""
    return await DashboardService.get_by_type(
        session=session,
        user=current_user,
    )


@router.get("/pending-actions", response_model=PendingActionsResponse)
async def get_pending_actions(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve actionable workload queues (pending verifications, discrepancies, release reviews)."""
    return await DashboardService.get_pending_actions(
        session=session,
        user=current_user,
    )


@router.get(
    "/impact-metrics",
    response_model=ImpactMetricsResponse,
    dependencies=[
        Depends(
            require_roles(
                UserRole.VERIFYING_OFFICER,
                UserRole.APPROVING_AUTHORITY,
                UserRole.ADMIN,
            )
        )
    ],
)
async def get_impact_metrics(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Retrieve operational efficiency and turnaround KPIs (Officers/Admin only)."""
    return await DashboardService.get_impact_metrics(
        session=session,
        user=current_user,
    )
