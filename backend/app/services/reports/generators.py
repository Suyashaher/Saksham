"""Implementations for the 8 system report types."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_, cast, Date, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.core.config import get_settings
from app.core.dependencies import scope_to_institution
from app.db.enums import (
    AlertStatus,
    FDRStatus,
    ReleaseRequestStatus,
    UserRole,
    VerificationTag,
)
from app.db.models.alert import Alert
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.observation import ScrutinyObservation
from app.db.models.release import ReleaseRequest
from app.db.models.user import User
from app.services.instrument_filters import missing_documents
from app.services.reports.base import BaseReport


class PendingVerificationsReport(BaseReport):
    slug = "pending-verifications"
    title = "Pending Scrutiny and Bank Verifications"
    description = "Instruments awaiting initial scrutiny or bank verification with ageing metrics."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        today = clock.today()
        q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(selectinload(Instrument.institution))
            .where(Instrument.status.in_([FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY]))
        )
        q = scope_to_institution(q, user, Instrument)
        q = q.order_by(Instrument.created_at.asc()).limit(max_rows + 1)

        records = (await session.execute(q)).scalars().all()
        is_truncated = len(records) > max_rows
        items = records[:max_rows]

        rows = []
        for inst in items:
            age = (today - inst.created_at.date()).days
            rows.append(
                {
                    "Reference Number": inst.reference_number,
                    "Institution Name": inst.institution.name,
                    "AICTE ID": inst.institution.aicte_id,
                    "Issuing Bank": inst.issuing_bank,
                    "Amount (INR)": str(inst.amount),
                    "Status": inst.status.value,
                    "Submission Date": inst.created_at.strftime("%Y-%m-%d"),
                    "Age (Days)": age,
                }
            )

        fieldnames = [
            "Reference Number",
            "Institution Name",
            "AICTE ID",
            "Issuing Bank",
            "Amount (INR)",
            "Status",
            "Submission Date",
            "Age (Days)",
        ]
        return rows, fieldnames, is_truncated


class UpcomingMaturitiesReport(BaseReport):
    slug = "upcoming-maturities"
    title = "Upcoming FDR Maturities Report"
    description = "Instruments reaching maturity within a configurable window (default 90 days)."
    supported_formats = ["json", "csv", "xlsx", "pdf"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        today = clock.today()
        days_window = int(params.get("days", 90))
        target_date = today + timedelta(days=days_window)

        q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(selectinload(Instrument.institution))
            .where(
                Instrument.maturity_date >= today,
                Instrument.maturity_date <= target_date,
                Instrument.status.in_([FDRStatus.ACTIVE, FDRStatus.EXPIRING]),
            )
        )
        q = scope_to_institution(q, user, Instrument)
        q = q.order_by(Instrument.maturity_date.asc()).limit(max_rows + 1)

        records = (await session.execute(q)).scalars().all()
        is_truncated = len(records) > max_rows
        items = records[:max_rows]

        rows = []
        for inst in items:
            days_left = (inst.maturity_date - today).days
            rows.append(
                {
                    "Reference Number": inst.reference_number,
                    "Institution Name": inst.institution.name,
                    "AICTE ID": inst.institution.aicte_id,
                    "Issuing Bank": inst.issuing_bank,
                    "Amount (INR)": str(inst.amount),
                    "Issue Date": str(inst.issue_date),
                    "Maturity Date": str(inst.maturity_date),
                    "Days to Maturity": days_left,
                    "Status": inst.status.value,
                }
            )

        fieldnames = [
            "Reference Number",
            "Institution Name",
            "AICTE ID",
            "Issuing Bank",
            "Amount (INR)",
            "Issue Date",
            "Maturity Date",
            "Days to Maturity",
            "Status",
        ]
        return rows, fieldnames, is_truncated


class MissingDocumentsReport(BaseReport):
    slug = "missing-documents"
    title = "Missing Mandatory Documents Audit Report"
    description = "Instruments lacking mandatory required documents (FDR scan or deposit confirmation)."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(
                selectinload(Instrument.institution),
                selectinload(Instrument.documents),
            )
            .where(Instrument.status != FDRStatus.RELEASED)
        )
        q = scope_to_institution(q, user, Instrument)
        q = q.order_by(Instrument.created_at.desc()).limit(max_rows + 1)

        records = (await session.execute(q)).scalars().all()
        rows = []
        for inst in records:
            missing = missing_documents(inst)
            if missing:
                rows.append(
                    {
                        "Reference Number": inst.reference_number,
                        "Institution Name": inst.institution.name,
                        "AICTE ID": inst.institution.aicte_id,
                        "Issuing Bank": inst.issuing_bank,
                        "Amount (INR)": str(inst.amount),
                        "Status": inst.status.value,
                        "Missing Documents": ", ".join(missing),
                    }
                )

        is_truncated = len(rows) > max_rows
        rows = rows[:max_rows]

        fieldnames = [
            "Reference Number",
            "Institution Name",
            "AICTE ID",
            "Issuing Bank",
            "Amount (INR)",
            "Status",
            "Missing Documents",
        ]
        return rows, fieldnames, is_truncated


class CasesNeedingInterventionReport(BaseReport):
    slug = "cases-needing-intervention"
    title = "High-Risk Cases Needing Immediate Regulatory Intervention"
    description = "Escalated alerts, overdue maturities, unresolved discrepancies, and stuck release requests."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        today = clock.today()
        rows: list[dict[str, Any]] = []

        # 1. Escalated alerts (level >= 1)
        alert_q = (
            select(Alert)
            .join(Instrument, Alert.instrument_id == Instrument.id)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(
                selectinload(Alert.instrument).selectinload(Instrument.institution)
            )
            .where(
                Alert.resolved == False,  # noqa: E712
                Alert.escalation_level >= 1,
            )
        )
        if user.role == UserRole.INSTITUTION:
            alert_q = alert_q.where(Instrument.institution_id == user.institution_id)

        alerts = (await session.execute(alert_q)).scalars().all()
        for a in alerts:
            rows.append(
                {
                    "Reference Number": a.instrument.reference_number,
                    "Institution Name": a.instrument.institution.name,
                    "AICTE ID": a.instrument.institution.aicte_id,
                    "Issue Category": "ESCALATED_ALERT",
                    "Details": f"Rule {a.rule_name} escalated to level {a.escalation_level}",
                    "Age / Overdue": f"Level {a.escalation_level}",
                    "Action Required": "Review escalated notification and take regulatory action",
                }
            )

        # 2. Overdue matured instruments
        matured_q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(selectinload(Instrument.institution))
            .where(
                Instrument.status == FDRStatus.MATURED,
                Instrument.maturity_date < today,
            )
        )
        matured_q = scope_to_institution(matured_q, user, Instrument)
        matured = (await session.execute(matured_q)).scalars().all()
        for m in matured:
            overdue_days = (today - m.maturity_date).days
            rows.append(
                {
                    "Reference Number": m.reference_number,
                    "Institution Name": m.institution.name,
                    "AICTE ID": m.institution.aicte_id,
                    "Issue Category": "OVERDUE_MATURED",
                    "Details": f"Instrument matured on {m.maturity_date} but has not been renewed or released",
                    "Age / Overdue": f"{overdue_days} days overdue",
                    "Action Required": "Follow up for renewal or initiate encashment",
                }
            )

        # 3. Discrepancies unresolved past 7 days
        disc_q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(selectinload(Instrument.institution))
            .where(
                Instrument.status == FDRStatus.DISCREPANCY,
                cast(Instrument.updated_at, Date) < today - timedelta(days=7),
            )
        )
        disc_q = scope_to_institution(disc_q, user, Instrument)
        disc = (await session.execute(disc_q)).scalars().all()
        for d in disc:
            days = (today - d.updated_at.date()).days
            rows.append(
                {
                    "Reference Number": d.reference_number,
                    "Institution Name": d.institution.name,
                    "AICTE ID": d.institution.aicte_id,
                    "Issue Category": "STALE_DISCREPANCY",
                    "Details": "Discrepancy flagged over 7 days ago with no institutional correction",
                    "Age / Overdue": f"{days} days in discrepancy",
                    "Action Required": "Issue formal show-cause compliance notice",
                }
            )

        is_truncated = len(rows) > max_rows
        rows = rows[:max_rows]

        fieldnames = [
            "Reference Number",
            "Institution Name",
            "AICTE ID",
            "Issue Category",
            "Details",
            "Age / Overdue",
            "Action Required",
        ]
        return rows, fieldnames, is_truncated


class ReleasePipelineReport(BaseReport):
    slug = "release-pipeline"
    title = "Release and Refund Workflow Pipeline Report"
    description = "Current status and stage ageing across all active release and refund requests."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        today = clock.today()
        q = (
            select(ReleaseRequest)
            .join(Instrument, ReleaseRequest.instrument_id == Instrument.id)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(
                selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution)
            )
        )
        if user.role == UserRole.INSTITUTION:
            q = q.where(Instrument.institution_id == user.institution_id)

        q = q.order_by(ReleaseRequest.created_at.desc()).limit(max_rows + 1)
        records = (await session.execute(q)).scalars().all()

        is_truncated = len(records) > max_rows
        items = records[:max_rows]

        rows = []
        for req in items:
            days_open = (today - req.created_at.date()).days
            rec_str = req.officer_recommendation.value if req.officer_recommendation else "PENDING_REVIEW"
            rows.append(
                {
                    "Request ID": str(req.id),
                    "Reference Number": req.instrument.reference_number,
                    "Institution Name": req.instrument.institution.name,
                    "AICTE ID": req.instrument.institution.aicte_id,
                    "Type": req.request_type.value,
                    "Status": req.status.value,
                    "Reason": req.reason,
                    "Officer Recommendation": rec_str,
                    "Days Open": days_open,
                    "Submitted On": req.created_at.strftime("%Y-%m-%d"),
                }
            )

        fieldnames = [
            "Request ID",
            "Reference Number",
            "Institution Name",
            "AICTE ID",
            "Type",
            "Status",
            "Reason",
            "Officer Recommendation",
            "Days Open",
            "Submitted On",
        ]
        return rows, fieldnames, is_truncated


class InstitutionStatementReport(BaseReport):
    slug = "institution-statement"
    title = "Institution Security Deposit Statement"
    description = "Complete portfolio statement of all FDR instruments for a designated institution."
    supported_formats = ["json", "csv", "xlsx", "pdf"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        q = (
            select(Instrument)
            .join(Institution, Instrument.institution_id == Institution.id)
            .options(selectinload(Instrument.institution))
        )
        # Determine institution scope
        if user.role == UserRole.INSTITUTION:
            q = q.where(Instrument.institution_id == user.institution_id)
        elif params.get("institution_id"):
            q = q.where(Instrument.institution_id == uuid.UUID(str(params["institution_id"])))

        q = q.order_by(Instrument.maturity_date.asc()).limit(max_rows + 1)
        records = (await session.execute(q)).scalars().all()

        is_truncated = len(records) > max_rows
        items = records[:max_rows]

        rows = []
        for inst in items:
            rows.append(
                {
                    "Reference Number": inst.reference_number,
                    "Issuing Bank": inst.issuing_bank,
                    "Branch": inst.branch or "Main",
                    "Amount (INR)": str(inst.amount),
                    "Issue Date": str(inst.issue_date),
                    "Maturity Date": str(inst.maturity_date),
                    "Status": inst.status.value,
                    "Verification Tag": inst.verification_tag.value,
                    "Registration Date": inst.created_at.strftime("%Y-%m-%d"),
                }
            )

        fieldnames = [
            "Reference Number",
            "Issuing Bank",
            "Branch",
            "Amount (INR)",
            "Issue Date",
            "Maturity Date",
            "Status",
            "Verification Tag",
            "Registration Date",
        ]
        return rows, fieldnames, is_truncated


class RenewalHistoryReport(BaseReport):
    slug = "renewal-history"
    title = "Instrument Renewal Lineage and History Report"
    description = "Audit trail of all renewed instruments and their antecedent links."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        old_inst = Instrument.__table__.alias("old_inst")
        q = (
            select(
                Instrument,
                old_inst.c.reference_number.label("old_ref"),
            )
            .join(Institution, Instrument.institution_id == Institution.id)
            .join(old_inst, Instrument.replaces_instrument_id == old_inst.c.id)
            .options(selectinload(Instrument.institution))
        )
        q = scope_to_institution(q, user, Instrument)
        q = q.order_by(Instrument.created_at.desc()).limit(max_rows + 1)

        result_rows = (await session.execute(q)).all()
        is_truncated = len(result_rows) > max_rows
        items = result_rows[:max_rows]

        rows = []
        for inst, old_ref in items:
            rows.append(
                {
                    "New Reference Number": inst.reference_number,
                    "Replaced Reference Number": old_ref,
                    "Institution Name": inst.institution.name,
                    "AICTE ID": inst.institution.aicte_id,
                    "Issuing Bank": inst.issuing_bank,
                    "Amount (INR)": str(inst.amount),
                    "New Maturity Date": str(inst.maturity_date),
                    "Renewal Date": inst.created_at.strftime("%Y-%m-%d"),
                }
            )

        fieldnames = [
            "New Reference Number",
            "Replaced Reference Number",
            "Institution Name",
            "AICTE ID",
            "Issuing Bank",
            "Amount (INR)",
            "New Maturity Date",
            "Renewal Date",
        ]
        return rows, fieldnames, is_truncated


class MyInstrumentsReport(BaseReport):
    slug = "my-instruments"
    title = "Institutional Portfolio Summary"
    description = "Self-service portfolio export for institution users."
    supported_formats = ["json", "csv", "xlsx"]

    async def fetch_data(
        self,
        session: AsyncSession,
        user: User,
        params: dict[str, Any],
        max_rows: int,
    ) -> tuple[list[dict[str, Any]], list[str], bool]:
        q = (
            select(Instrument)
            .options(selectinload(Instrument.documents))
            .where(Instrument.institution_id == user.institution_id)
            .order_by(Instrument.maturity_date.asc())
            .limit(max_rows + 1)
        )
        records = (await session.execute(q)).scalars().all()
        is_truncated = len(records) > max_rows
        items = records[:max_rows]

        rows = []
        for inst in items:
            missing = missing_documents(inst)
            rows.append(
                {
                    "Reference Number": inst.reference_number,
                    "Issuing Bank": inst.issuing_bank,
                    "Branch": inst.branch or "Main",
                    "Amount (INR)": str(inst.amount),
                    "Issue Date": str(inst.issue_date),
                    "Maturity Date": str(inst.maturity_date),
                    "Status": inst.status.value,
                    "Verification Tag": inst.verification_tag.value,
                    "Missing Documents": ", ".join(missing) if missing else "None",
                }
            )

        fieldnames = [
            "Reference Number",
            "Issuing Bank",
            "Branch",
            "Amount (INR)",
            "Issue Date",
            "Maturity Date",
            "Status",
            "Verification Tag",
            "Missing Documents",
        ]
        return rows, fieldnames, is_truncated
