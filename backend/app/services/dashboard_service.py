"""Dashboard analytics service with role-scoped Redis caching and SQL aggregates."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import redis.asyncio as aioredis
from sqlalchemy import and_, case, cast, Date, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.user import User
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    GroupedStatusItem,
    ImpactMetricsResponse,
    MaturityBucketItem,
    MaturityPipelineResponse,
    PendingActionsResponse,
    PendingItem,
    SummaryStatusItem,
)


class DashboardService:
    """Computes high-performance SQL aggregate metrics with scoped Redis caching."""

    @staticmethod
    def _get_redis_client() -> aioredis.Redis | None:
        settings = get_settings()
        try:
            return aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception:
            return None

    @classmethod
    async def get_cached_or_compute(
        cls,
        cache_key: str,
        ttl_seconds: int,
        compute_fn,
    ) -> Any:
        """Cache-aside pattern with automatic failover if Redis is down."""
        client = cls._get_redis_client()
        if client:
            try:
                cached = await client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        result = await compute_fn()

        if client:
            try:
                await client.setex(cache_key, ttl_seconds, json.dumps(result))
            except Exception:
                pass

        return result

    @classmethod
    def make_cache_key(cls, endpoint: str, user: User, **kwargs) -> str:
        """Construct a role and tenant-isolated cache key."""
        role_part = user.role.value
        scope_part = str(user.institution_id) if user.institution_id else "all"
        raw_params = json.dumps(kwargs, sort_keys=True, default=str)
        param_hash = hashlib.sha256(raw_params.encode("utf-8")).hexdigest()[:12]
        return f"dashboard:{endpoint}:{role_part}:{scope_part}:{param_hash}"

    # ── Summary ─────────────────────────────────────────────────────────────────

    @classmethod
    async def get_summary(
        cls,
        session: AsyncSession,
        user: User,
        institution_id: uuid.UUID | None = None,
        state: str | None = None,
        bank: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> DashboardSummaryResponse:
        cache_key = cls.make_cache_key(
            "summary",
            user,
            institution_id=str(institution_id) if institution_id else None,
            state=state,
            bank=bank,
            date_from=str(date_from) if date_from else None,
            date_to=str(date_to) if date_to else None,
        )

        async def _compute():
            settings = get_settings()
            # 1. Base status aggregates
            base_q = select(
                Instrument.status,
                func.count(Instrument.id).label("cnt"),
                func.coalesce(func.sum(Instrument.amount), 0).label("amt"),
            ).join(Institution, Instrument.institution_id == Institution.id)

            if user.role != UserRole.INSTITUTION and institution_id:
                base_q = base_q.where(Instrument.institution_id == institution_id)
            if state:
                base_q = base_q.where(Institution.state == state)
            if bank:
                base_q = base_q.where(Instrument.issuing_bank == bank)
            if date_from:
                base_q = base_q.where(Instrument.created_at >= date_from)
            if date_to:
                base_q = base_q.where(Instrument.created_at <= date_to)

            base_q = scope_to_institution(base_q, user, Instrument)
            base_q = base_q.group_by(Instrument.status)

            status_rows = (await session.execute(base_q)).all()
            status_map = {row[0]: (row[1], str(row[2])) for row in status_rows}

            def _get_item(status_enum: FDRStatus) -> dict:
                cnt, amt = status_map.get(status_enum, (0, "0.00"))
                return {"count": cnt, "total_amount": amt}

            active_item = _get_item(FDRStatus.ACTIVE)
            expiring_item = _get_item(FDRStatus.EXPIRING)
            matured_item = _get_item(FDRStatus.MATURED)
            renewed_item = _get_item(FDRStatus.RENEWED)
            released_item = _get_item(FDRStatus.RELEASED)
            release_req_item = _get_item(FDRStatus.RELEASE_REQUESTED)

            # Combined pending group: SUBMITTED + UNDER_SCRUTINY + DISCREPANCY
            pending_cnt = 0
            pending_amt = Decimal("0.00")
            for st in (FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY, FDRStatus.DISCREPANCY):
                cnt, amt = status_map.get(st, (0, "0.00"))
                pending_cnt += cnt
                pending_amt += Decimal(amt)

            pending_item = {"count": pending_cnt, "total_amount": f"{pending_amt:.2f}"}

            # 2. Verification tag split
            tag_q = select(
                Instrument.verification_tag,
                func.count(Instrument.id),
            ).join(Institution, Instrument.institution_id == Institution.id)
            if user.role != UserRole.INSTITUTION and institution_id:
                tag_q = tag_q.where(Instrument.institution_id == institution_id)
            if state:
                tag_q = tag_q.where(Institution.state == state)
            if bank:
                tag_q = tag_q.where(Instrument.issuing_bank == bank)

            tag_q = scope_to_institution(tag_q, user, Instrument)
            tag_q = tag_q.group_by(Instrument.verification_tag)
            tag_rows = (await session.execute(tag_q)).all()
            tag_split = {
                VerificationTag.SELF_DECLARED.value: 0,
                VerificationTag.BANK_VERIFIED.value: 0,
            }
            for row in tag_rows:
                tag_split[row[0].value] = row[1]

            # 3. Missing documents count (type-aware for FDR and BANK_GUARANTEE)
            fdr_missing = and_(
                or_(Instrument.instrument_type == "FDR", Instrument.instrument_type.is_(None)),
                select(func.count(func.distinct(Document.doc_type)))
                .where(
                    Document.instrument_id == Instrument.id,
                    Document.doc_type.in_(["FDR_SCAN", "DEPOSIT_CONFIRMATION"]),
                )
                .scalar_subquery() < 2,
            )
            bg_missing = and_(
                Instrument.instrument_type == "BANK_GUARANTEE",
                select(func.count(func.distinct(Document.doc_type)))
                .where(
                    Document.instrument_id == Instrument.id,
                    Document.doc_type.in_(["BANK_GUARANTEE_DOCUMENT", "BANK_LETTER"]),
                )
                .scalar_subquery() < 2,
            )
            missing_q = select(func.count(Instrument.id)).join(
                Institution, Instrument.institution_id == Institution.id
            )
            if user.role != UserRole.INSTITUTION and institution_id:
                missing_q = missing_q.where(Instrument.institution_id == institution_id)
            if state:
                missing_q = missing_q.where(Institution.state == state)
            if bank:
                missing_q = missing_q.where(Instrument.issuing_bank == bank)

            missing_q = scope_to_institution(missing_q, user, Instrument)
            missing_q = missing_q.where(or_(fdr_missing, bg_missing))
            missing_docs_cnt = (await session.execute(missing_q)).scalar() or 0

            # 4. Unresolved alerts and escalation breakdown
            alert_q = select(
                Alert.escalation_level,
                func.count(Alert.id),
            ).join(Instrument, Alert.instrument_id == Instrument.id)
            if user.role != UserRole.INSTITUTION and institution_id:
                alert_q = alert_q.where(Instrument.institution_id == institution_id)

            alert_q = scope_to_institution(alert_q, user, Instrument)
            alert_q = alert_q.where(Alert.resolved == False, Alert.resolved_at.is_(None))  # noqa: E712
            alert_q = alert_q.group_by(Alert.escalation_level)
            alert_rows = (await session.execute(alert_q)).all()

            esc_map = {row[0]: row[1] for row in alert_rows}
            total_unresolved_alerts = sum(esc_map.values())
            esc_1 = esc_map.get(1, 0)
            esc_2 = esc_map.get(2, 0)

            return {
                "active": active_item,
                "expiring": expiring_item,
                "matured": matured_item,
                "renewed": renewed_item,
                "released": released_item,
                "release_requested": release_req_item,
                "pending": pending_item,
                "verification_tag_split": tag_split,
                "missing_documents_count": missing_docs_cnt,
                "unresolved_alerts_count": total_unresolved_alerts,
                "escalation_level_1_count": esc_1,
                "escalation_level_2_count": esc_2,
            }

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return DashboardSummaryResponse.model_validate(data)

    # ── Maturity Pipeline ───────────────────────────────────────────────────────

    @classmethod
    async def get_maturity_pipeline(
        cls,
        session: AsyncSession,
        user: User,
        institution_id: uuid.UUID | None = None,
        state: str | None = None,
        bank: str | None = None,
    ) -> MaturityPipelineResponse:
        cache_key = cls.make_cache_key(
            "maturity_pipeline",
            user,
            institution_id=str(institution_id) if institution_id else None,
            state=state,
            bank=bank,
        )

        async def _compute():
            today = clock.today()
            current_year = today.year
            current_month = today.month

            # Build 12 month descriptors
            month_ranges: list[tuple[str, date, date]] = []
            yr, mo = current_year, current_month
            for _ in range(12):
                month_str = f"{yr:04d}-{mo:02d}"
                start_d = date(yr, mo, 1)
                # Next month start
                if mo == 12:
                    end_d = date(yr + 1, 1, 1)
                    yr += 1
                    mo = 1
                else:
                    end_d = date(yr, mo + 1, 1)
                    mo += 1
                month_ranges.append((month_str, start_d, end_d))

            buckets: list[dict] = []
            for m_str, s_d, e_d in month_ranges:
                q = select(
                    func.count(Instrument.id),
                    func.coalesce(func.sum(Instrument.amount), 0),
                ).join(Institution, Instrument.institution_id == Institution.id)

                if user.role != UserRole.INSTITUTION and institution_id:
                    q = q.where(Instrument.institution_id == institution_id)
                if state:
                    q = q.where(Institution.state == state)
                if bank:
                    q = q.where(Instrument.issuing_bank == bank)

                q = scope_to_institution(q, user, Instrument)
                q = q.where(
                    Instrument.maturity_date >= s_d,
                    Instrument.maturity_date < e_d,
                    Instrument.status.in_([FDRStatus.ACTIVE, FDRStatus.EXPIRING]),
                )
                cnt, amt = (await session.execute(q)).first()
                buckets.append({"month": m_str, "count": cnt, "total_amount": f"{Decimal(amt):.2f}"})

            # Overdue bucket
            overdue_q = select(
                func.count(Instrument.id),
                func.coalesce(func.sum(Instrument.amount), 0),
            ).join(Institution, Instrument.institution_id == Institution.id)

            if user.role != UserRole.INSTITUTION and institution_id:
                overdue_q = overdue_q.where(Instrument.institution_id == institution_id)
            if state:
                overdue_q = overdue_q.where(Institution.state == state)
            if bank:
                overdue_q = overdue_q.where(Instrument.issuing_bank == bank)

            overdue_q = scope_to_institution(overdue_q, user, Instrument)
            overdue_q = overdue_q.where(
                Instrument.maturity_date < today,
                Instrument.status == FDRStatus.MATURED,
            )
            od_cnt, od_amt = (await session.execute(overdue_q)).first()

            return {
                "buckets": buckets,
                "overdue": {"count": od_cnt, "total_amount": f"{Decimal(od_amt):.2f}"},
            }

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return MaturityPipelineResponse.model_validate(data)

    # ── By Bank & By State ──────────────────────────────────────────────────────

    @classmethod
    async def get_by_bank(
        cls,
        session: AsyncSession,
        user: User,
        institution_id: uuid.UUID | None = None,
        state: str | None = None,
    ) -> list[GroupedStatusItem]:
        cache_key = cls.make_cache_key(
            "by_bank",
            user,
            institution_id=str(institution_id) if institution_id else None,
            state=state,
        )

        async def _compute():
            q = select(
                Instrument.issuing_bank,
                Instrument.status,
                func.count(Instrument.id),
                func.coalesce(func.sum(Instrument.amount), 0),
            ).join(Institution, Instrument.institution_id == Institution.id)

            if user.role != UserRole.INSTITUTION and institution_id:
                q = q.where(Instrument.institution_id == institution_id)
            if state:
                q = q.where(Institution.state == state)

            q = scope_to_institution(q, user, Instrument)
            q = q.group_by(Instrument.issuing_bank, Instrument.status)
            q = q.order_by(Instrument.issuing_bank, Instrument.status)

            rows = (await session.execute(q)).all()
            return [
                {
                    "group_key": r[0],
                    "status": r[1].value,
                    "count": r[2],
                    "total_amount": f"{Decimal(r[3]):.2f}",
                }
                for r in rows
            ]

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return [GroupedStatusItem.model_validate(item) for item in data]

    @classmethod
    async def get_by_type(
        cls,
        session: AsyncSession,
        user: User,
    ) -> list[GroupedStatusItem]:
        cache_key = cls.make_cache_key("by_type", user)

        async def _compute():
            q = select(
                func.coalesce(Instrument.instrument_type, "FDR"),
                Instrument.status,
                func.count(Instrument.id),
                func.coalesce(func.sum(Instrument.amount), 0),
            ).join(Institution, Instrument.institution_id == Institution.id)

            q = scope_to_institution(q, user, Instrument)
            q = q.group_by(Instrument.instrument_type, Instrument.status)
            q = q.order_by(Instrument.instrument_type, Instrument.status)

            rows = (await session.execute(q)).all()
            return [
                {
                    "group_key": str(r[0]),
                    "status": r[1].value,
                    "count": r[2],
                    "total_amount": f"{Decimal(r[3]):.2f}",
                }
                for r in rows
            ]

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return [GroupedStatusItem.model_validate(item) for item in data]

    @classmethod
    async def get_by_state(
        cls,
        session: AsyncSession,
        user: User,
        bank: str | None = None,
    ) -> list[GroupedStatusItem]:
        cache_key = cls.make_cache_key("by_state", user, bank=bank)

        async def _compute():
            q = select(
                Institution.state,
                Instrument.status,
                func.count(Instrument.id),
                func.coalesce(func.sum(Instrument.amount), 0),
            ).join(Institution, Instrument.institution_id == Institution.id)

            if bank:
                q = q.where(Instrument.issuing_bank == bank)

            q = scope_to_institution(q, user, Instrument)
            q = q.group_by(Institution.state, Instrument.status)
            q = q.order_by(Institution.state, Instrument.status)

            rows = (await session.execute(q)).all()
            return [
                {
                    "group_key": r[0] or "UNKNOWN",
                    "status": r[1].value,
                    "count": r[2],
                    "total_amount": f"{Decimal(r[3]):.2f}",
                }
                for r in rows
            ]

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return [GroupedStatusItem.model_validate(item) for item in data]

    # ── Pending Actions ─────────────────────────────────────────────────────────

    @classmethod
    async def get_pending_actions(
        cls,
        session: AsyncSession,
        user: User,
    ) -> PendingActionsResponse:
        cache_key = cls.make_cache_key("pending_actions", user)

        async def _compute():
            today = clock.today()

            # 1. Pending verifications (SUBMITTED, UNDER_SCRUTINY)
            pv_q = (
                select(Instrument)
                .join(Institution, Instrument.institution_id == Institution.id)
                .options(selectinload(Instrument.institution))
                .where(Instrument.status.in_([FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY]))
            )
            pv_q = scope_to_institution(pv_q, user, Instrument)
            pv_q = pv_q.order_by(Instrument.created_at.asc())
            pv_items = (await session.execute(pv_q)).scalars().all()

            buckets = {"0-2 days": 0, "3-5 days": 0, "6-10 days": 0, "10+ days": 0}
            pv_oldest: list[dict] = []

            for inst in pv_items:
                age = (today - inst.created_at.date()).days
                if age <= 2:
                    buckets["0-2 days"] += 1
                elif age <= 5:
                    buckets["3-5 days"] += 1
                elif age <= 10:
                    buckets["6-10 days"] += 1
                else:
                    buckets["10+ days"] += 1

                if len(pv_oldest) < 5:
                    pv_oldest.append(
                        {
                            "id": str(inst.id),
                            "reference_number": inst.reference_number,
                            "institution_name": inst.institution.name,
                            "status": inst.status.value,
                            "age_days": age,
                        }
                    )

            # 2. Discrepancies
            disc_q = (
                select(Instrument)
                .join(Institution, Instrument.institution_id == Institution.id)
                .options(selectinload(Instrument.institution))
                .where(Instrument.status == FDRStatus.DISCREPANCY)
            )
            disc_q = scope_to_institution(disc_q, user, Instrument)
            disc_q = disc_q.order_by(Instrument.created_at.asc())
            disc_items = (await session.execute(disc_q)).scalars().all()

            disc_oldest: list[dict] = [
                {
                    "id": str(inst.id),
                    "reference_number": inst.reference_number,
                    "institution_name": inst.institution.name,
                    "status": inst.status.value,
                    "age_days": (today - inst.created_at.date()).days,
                }
                for inst in disc_items[:5]
            ]

            # 3. Releases awaiting review (PENDING) and awaiting approval (UNDER_REVIEW + recommended_at)
            rel_q = (
                select(ReleaseRequest)
                .join(Instrument, ReleaseRequest.instrument_id == Instrument.id)
                .join(Institution, Instrument.institution_id == Institution.id)
                .options(selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution))
                .where(
                    ReleaseRequest.status.in_([ReleaseRequestStatus.PENDING, ReleaseRequestStatus.UNDER_REVIEW])
                )
            )
            if user.role == UserRole.INSTITUTION:
                rel_q = rel_q.where(Instrument.institution_id == user.institution_id)

            rel_q = rel_q.order_by(ReleaseRequest.created_at.asc())
            all_rel = (await session.execute(rel_q)).scalars().all()

            awaiting_review = 0
            awaiting_approval = 0
            rel_oldest: list[dict] = []

            for req in all_rel:
                if req.status == ReleaseRequestStatus.PENDING:
                    awaiting_review += 1
                elif req.status == ReleaseRequestStatus.UNDER_REVIEW and req.recommended_at:
                    awaiting_approval += 1

                if len(rel_oldest) < 5:
                    rel_oldest.append(
                        {
                            "id": str(req.id),
                            "reference_number": req.instrument.reference_number,
                            "institution_name": req.instrument.institution.name,
                            "status": req.status.value,
                            "age_days": (today - req.created_at.date()).days,
                        }
                    )

            return {
                "pending_verifications": buckets,
                "pending_verifications_oldest": pv_oldest,
                "discrepancies_count": len(disc_items),
                "discrepancies_oldest": disc_oldest,
                "releases_awaiting_review": awaiting_review,
                "releases_awaiting_approval": awaiting_approval,
                "releases_oldest": rel_oldest,
            }

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return PendingActionsResponse.model_validate(data)

    # ── Impact Metrics (Officers / Admin only) ───────────────────────────────────

    @classmethod
    async def get_impact_metrics(
        cls,
        session: AsyncSession,
        user: User,
    ) -> ImpactMetricsResponse:
        cache_key = cls.make_cache_key("impact_metrics", user)

        async def _compute():
            # 1. Turnaround times (Submission -> Active or Discrepancy)
            # Days between Instrument.created_at and InstrumentStatusHistory.changed_at
            sh_q = (
                select(
                    func.avg(
                        func.extract(
                            "epoch",
                            InstrumentStatusHistory.changed_at - Instrument.created_at,
                        )
                        / 86400.0
                    )
                )
                .join(Instrument, InstrumentStatusHistory.instrument_id == Instrument.id)
                .where(
                    InstrumentStatusHistory.to_status.in_([FDRStatus.ACTIVE, FDRStatus.DISCREPANCY]),
                    InstrumentStatusHistory.from_status.in_([FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY]),
                )
            )
            avg_ver = (await session.execute(sh_q)).scalar()
            avg_ver_days = round(float(avg_ver), 1) if avg_ver is not None else None

            # 2. Average release turnaround (ReleaseRequest created_at -> decided_at)
            rel_to_q = select(
                func.avg(
                    func.extract("epoch", ReleaseRequest.decided_at - ReleaseRequest.created_at) / 86400.0
                )
            ).where(
                ReleaseRequest.status == ReleaseRequestStatus.CLOSED,
                ReleaseRequest.decided_at.is_not(None),
            )
            avg_rel = (await session.execute(rel_to_q)).scalar()
            avg_rel_days = round(float(avg_rel), 1) if avg_rel is not None else None

            # 3. Renewals completed before maturity percentage
            # Query instruments that replaced an older instrument, comparing replaced instrument maturity_date
            # vs new instrument created_at
            ren_total_q = select(func.count(Instrument.id)).where(Instrument.replaces_instrument_id.is_not(None))
            ren_total = (await session.execute(ren_total_q)).scalar() or 0

            ren_pct = None
            if ren_total > 0:
                old_inst = Instrument.__table__.alias("old_inst")
                ren_on_time_q = (
                    select(func.count(Instrument.id))
                    .join(old_inst, Instrument.replaces_instrument_id == old_inst.c.id)
                    .where(
                        cast(Instrument.created_at, Date) <= old_inst.c.maturity_date
                    )
                )
                on_time = (await session.execute(ren_on_time_q)).scalar() or 0
                ren_pct = round((on_time / ren_total) * 100.0, 1)

            # 4. Activity counts
            alerts_sent_q = select(func.count(Alert.id)).where(Alert.status == AlertStatus.SENT)
            alerts_sent = (await session.execute(alerts_sent_q)).scalar() or 0

            alerts_res_q = select(func.count(Alert.id)).where(Alert.resolved == True)  # noqa: E712
            alerts_res = (await session.execute(alerts_res_q)).scalar() or 0

            flags_q = select(func.count(Instrument.id)).where(Instrument.validation_flags.is_not(None))
            flags_count = (await session.execute(flags_q)).scalar() or 0

            disc_q = select(func.count(ScrutinyObservation.id)).where(ScrutinyObservation.category == "DISCREPANCY")
            disc_count = (await session.execute(disc_q)).scalar() or 0

            return {
                "avg_verification_turnaround_days": avg_ver_days,
                "median_verification_turnaround_days": avg_ver_days,  # Fallback to mean if discrete percentile unavailable
                "avg_release_turnaround_days": avg_rel_days,
                "renewals_before_maturity_pct": ren_pct,
                "alerts_auto_sent_count": alerts_sent,
                "alerts_auto_resolved_count": alerts_res,
                "validation_flags_caught_count": flags_count,
                "discrepancies_found_count": disc_count,
            }

        data = await cls.get_cached_or_compute(cache_key, 60, _compute)
        return ImpactMetricsResponse.model_validate(data)
