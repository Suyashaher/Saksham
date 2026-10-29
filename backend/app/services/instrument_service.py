"""Instrument CRUD orchestration service."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import scope_to_institution
from app.db.enums import FDRStatus, UserRole, VerificationTag
from app.db.models.instrument import Instrument
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.user import User
from app.services.audit_service import AuditService
from app.services.validation import validate_instrument


class InstrumentService:
    """High-level operations on FDR instruments."""

    @staticmethod
    async def create(
        session: AsyncSession,
        data: dict,
        user: User,
    ) -> Instrument:
        """Create a new instrument after running validation rules.

        Raises ValueError if any ERROR-level validation issues are found.
        The caller is responsible for committing the session.
        """
        issues = await validate_instrument(session, data)
        errors = [i for i in issues if i.severity == "ERROR"]
        if errors:
            raise ValueError(
                [{"field": i.field, "code": i.code, "message": i.message} for i in errors]
            )

        warnings = [i for i in issues if i.severity == "WARNING"]

        instrument = Instrument(
            institution_id=user.institution_id,
            reference_number=data["reference_number"],
            issuing_bank=data["issuing_bank"],
            amount=data["amount"],
            issue_date=data["issue_date"],
            maturity_date=data["maturity_date"],
            branch=data.get("branch"),
            required_amount=data.get("required_amount"),
            instrument_type=data.get("instrument_type", "FDR") or "FDR",
            claim_expiry_date=data.get("claim_expiry_date"),
            beneficiary_name=data.get("beneficiary_name", "AICTE") or "AICTE",
            status=FDRStatus.SUBMITTED,
            verification_tag=VerificationTag.SELF_DECLARED,
            validation_flags=(
                [{"field": w.field, "code": w.code, "message": w.message} for w in warnings]
                if warnings
                else None
            ),
        )
        session.add(instrument)
        # Flush to populate instrument.id before creating history & audit
        await session.flush()

        history = InstrumentStatusHistory(
            instrument_id=instrument.id,
            from_status=None,
            to_status=FDRStatus.SUBMITTED,
            changed_by=user.id,
            note="Initial submission",
        )
        session.add(history)

        await AuditService.record(
            session,
            actor_id=user.id,
            action="instrument_create",
            entity_type="instrument",
            entity_id=instrument.id,
            payload={
                "reference_number": data["reference_number"],
                "issuing_bank": data["issuing_bank"],
                "amount": str(data["amount"]),
            },
        )

        return instrument

    @staticmethod
    async def update(
        session: AsyncSession,
        instrument: Instrument,
        data: dict,
        user: User,
    ) -> Instrument:
        """Update an existing instrument after re-validation.

        Only allowed when status is SUBMITTED or DISCREPANCY.
        Raises ValueError on validation errors or disallowed changes.
        The caller is responsible for committing the session.
        """
        if instrument.status not in (FDRStatus.SUBMITTED, FDRStatus.DISCREPANCY):
            raise ValueError(
                f"Instrument cannot be edited in status '{instrument.status.value}'"
            )

        if data.get("verification_tag") == VerificationTag.BANK_VERIFIED or data.get(
            "verification_tag"
        ) == VerificationTag.BANK_VERIFIED.value:
            raise ValueError("Cannot manually set verification_tag to BANK_VERIFIED")

        # Build before snapshot and merge data
        before: dict = {}
        after: dict = {}
        merged = {
            "reference_number": instrument.reference_number,
            "issuing_bank": instrument.issuing_bank,
            "amount": instrument.amount,
            "issue_date": instrument.issue_date,
            "maturity_date": instrument.maturity_date,
            "branch": instrument.branch,
            "required_amount": instrument.required_amount,
            "instrument_type": instrument.instrument_type,
            "claim_expiry_date": instrument.claim_expiry_date,
            "beneficiary_name": instrument.beneficiary_name,
        }

        updatable_fields = (
            "reference_number",
            "issuing_bank",
            "amount",
            "issue_date",
            "maturity_date",
            "branch",
            "required_amount",
            "instrument_type",
            "claim_expiry_date",
            "beneficiary_name",
        )

        for field in updatable_fields:
            if field in data:
                old_val = getattr(instrument, field)
                new_val = data[field]
                if str(old_val) != str(new_val) if old_val is not None else new_val is not None:
                    before[field] = str(old_val) if old_val is not None else None
                    after[field] = str(new_val) if new_val is not None else None
                merged[field] = new_val

        # Re-validate merged data
        issues = await validate_instrument(session, merged, instrument_id=instrument.id)
        errors = [i for i in issues if i.severity == "ERROR"]
        if errors:
            raise ValueError(
                [{"field": i.field, "code": i.code, "message": i.message} for i in errors]
            )

        warnings = [i for i in issues if i.severity == "WARNING"]

        # Apply changes
        for field in updatable_fields:
            if field in data:
                setattr(instrument, field, data[field])

        instrument.validation_flags = (
            [{"field": w.field, "code": w.code, "message": w.message} for w in warnings]
            if warnings
            else None
        )

        await AuditService.record(
            session,
            actor_id=user.id,
            action="instrument_update",
            entity_type="instrument",
            entity_id=instrument.id,
            payload={"before": before, "after": after},
        )

        return instrument

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        instrument_id: uuid.UUID,
        user: User,
    ) -> Instrument | None:
        """Fetch a single instrument with eager-loaded relations.

        INSTITUTION users are scoped to their own institution.
        Returns None if not found or not accessible.
        """
        query = (
            select(Instrument)
            .where(Instrument.id == instrument_id)
            .options(
                selectinload(Instrument.documents),
                selectinload(Instrument.verification_records),
                selectinload(Instrument.observations),
                selectinload(Instrument.status_history),
            )
        )

        user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role_str == UserRole.INSTITUTION.value:
            query = scope_to_institution(query, user, Instrument)

        result = await session.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_instruments(
        session: AsyncSession,
        user: User,
        *,
        page: int = 1,
        page_size: int = 20,
        status: FDRStatus | None = None,
        bank: str | None = None,
        institution_id: uuid.UUID | None = None,
        maturity_from=None,
        maturity_to=None,
        search: str | None = None,
    ) -> tuple[list[Instrument], int]:
        """Paginated, filtered instrument listing with institution scoping.

        Returns (items, total_count).
        """
        query = select(Instrument)
        count_query = select(func.count()).select_from(Instrument)

        # Apply institution scoping
        query = scope_to_institution(query, user, Instrument)
        count_query = scope_to_institution(count_query, user, Instrument)

        # Filters
        if status is not None:
            query = query.where(Instrument.status == status)
            count_query = count_query.where(Instrument.status == status)
        if bank is not None:
            query = query.where(Instrument.issuing_bank.ilike(f"%{bank}%"))
            count_query = count_query.where(Instrument.issuing_bank.ilike(f"%{bank}%"))
        if institution_id is not None:
            query = query.where(Instrument.institution_id == institution_id)
            count_query = count_query.where(Instrument.institution_id == institution_id)
        if maturity_from is not None:
            query = query.where(Instrument.maturity_date >= maturity_from)
            count_query = count_query.where(Instrument.maturity_date >= maturity_from)
        if maturity_to is not None:
            query = query.where(Instrument.maturity_date <= maturity_to)
            count_query = count_query.where(Instrument.maturity_date <= maturity_to)
        if search is not None:
            pattern = f"%{search}%"
            query = query.where(
                Instrument.reference_number.ilike(pattern)
                | Instrument.issuing_bank.ilike(pattern)
            )
            count_query = count_query.where(
                Instrument.reference_number.ilike(pattern)
                | Instrument.issuing_bank.ilike(pattern)
            )

        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.order_by(Instrument.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(query)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def get_queue(
        session: AsyncSession,
        user: User,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Instrument], int]:
        """Scrutiny queue for a verifying officer.

        Returns instruments with status=SUBMITTED (unassigned) or
        UNDER_SCRUTINY where assigned_officer_id matches the current user.
        Ordered by created_at ASC (oldest first).
        """
        condition = (
            (Instrument.status == FDRStatus.SUBMITTED)
            & (Instrument.assigned_officer_id.is_(None))
        ) | (
            (Instrument.status == FDRStatus.UNDER_SCRUTINY)
            & (Instrument.assigned_officer_id == user.id)
        )

        query = select(Instrument).where(condition)
        count_query = select(func.count()).select_from(Instrument).where(condition)

        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.order_by(Instrument.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(query)
        items = list(result.scalars().all())

        return items, total
