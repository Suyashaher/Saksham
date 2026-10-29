"""Shared SQL-injection-safe filter and query builder layer."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.dependencies import scope_to_institution
from app.db.enums import FDRStatus, VerificationTag
from app.db.models.alert import Alert
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.user import User

SORT_COLUMNS = {
    "created_at": Instrument.created_at,
    "amount": Instrument.amount,
    "maturity_date": Instrument.maturity_date,
    "issue_date": Instrument.issue_date,
    "reference_number": Instrument.reference_number,
}


def missing_documents(instrument: Instrument) -> list[str]:
    """Return list of required document types missing from the given instrument."""
    from app.core.document_registry import DocumentRegistry
    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    required = set(DocumentRegistry.get_required_doc_types(itype))
    present = {doc.doc_type for doc in (instrument.documents or [])}
    return sorted(list(required - present))


class InstrumentFilter(BaseModel):
    """Filter parameters for instrument search, dashboard aggregation, and reports.

    extra="forbid" ensures unknown fields are rejected with HTTP 422.
    """

    model_config = ConfigDict(extra="forbid")

    statuses: list[FDRStatus] | None = None
    verification_tag: VerificationTag | None = None
    banks: list[str] | None = None
    states: list[str] | None = None
    institution_ids: list[uuid.UUID] | None = None
    amount_min: Decimal | None = None
    amount_max: Decimal | None = None
    maturity_from: date | None = None
    maturity_to: date | None = None
    issue_from: date | None = None
    issue_to: date | None = None
    has_missing_documents: bool | None = None
    has_open_alerts: bool | None = None
    escalation_level_min: int | None = None
    text: str | None = None
    instrument_types: list[str] | None = None
    missing_doc_types: list[str] | None = None
    sort_by: Literal["created_at", "amount", "maturity_date", "issue_date", "reference_number"] = "created_at"
    sort_dir: Literal["asc", "desc"] = "desc"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)


def build_query(
    filter_params: InstrumentFilter,
    user: User,
    include_relationships: bool = True,
) -> Select:
    """Build a parameterized SQLAlchemy query for instruments based on filter parameters.

    ALWAYS applies `scope_to_institution` last to prevent any filter parameter from
    escaping or widening tenant visibility.
    """
    settings = get_settings()
    query = select(Instrument).join(Institution, Instrument.institution_id == Institution.id)

    if include_relationships:
        query = query.options(
            selectinload(Instrument.institution),
            selectinload(Instrument.documents),
            selectinload(Instrument.verification_records),
            selectinload(Instrument.observations),
            selectinload(Instrument.status_history),
        )

    conditions = []

    # Statuses
    if filter_params.statuses:
        conditions.append(Instrument.status.in_(filter_params.statuses))

    # Verification tag
    if filter_params.verification_tag:
        conditions.append(Instrument.verification_tag == filter_params.verification_tag)

    # Banks
    if filter_params.banks:
        conditions.append(Instrument.issuing_bank.in_(filter_params.banks))

    # States
    if filter_params.states:
        conditions.append(Institution.state.in_(filter_params.states))

    # Institution IDs (if allowed by role)
    if filter_params.institution_ids:
        conditions.append(Instrument.institution_id.in_(filter_params.institution_ids))

    # Amounts
    if filter_params.amount_min is not None:
        conditions.append(Instrument.amount >= filter_params.amount_min)
    if filter_params.amount_max is not None:
        conditions.append(Instrument.amount <= filter_params.amount_max)

    # Dates
    if filter_params.maturity_from:
        conditions.append(Instrument.maturity_date >= filter_params.maturity_from)
    if filter_params.maturity_to:
        conditions.append(Instrument.maturity_date <= filter_params.maturity_to)
    if filter_params.issue_from:
        conditions.append(Instrument.issue_date >= filter_params.issue_from)
    if filter_params.issue_to:
        conditions.append(Instrument.issue_date <= filter_params.issue_to)

    # Instrument Types
    if filter_params.instrument_types:
        conditions.append(Instrument.instrument_type.in_(filter_params.instrument_types))

    # Missing specific document types
    if filter_params.missing_doc_types:
        for m_type in filter_params.missing_doc_types:
            has_doc_subquery = (
                select(Document.id)
                .where(
                    Document.instrument_id == Instrument.id,
                    Document.doc_type == m_type,
                )
                .exists()
            )
            conditions.append(~has_doc_subquery)

    # Missing documents (type-aware)
    if filter_params.has_missing_documents is not None:
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
        if filter_params.has_missing_documents:
            conditions.append(or_(fdr_missing, bg_missing))
        else:
            conditions.append(and_(~fdr_missing, ~bg_missing))

    # Open alerts / escalation level
    if filter_params.has_open_alerts is not None or filter_params.escalation_level_min is not None:
        alert_filters = [
            Alert.instrument_id == Instrument.id,
            Alert.resolved == False,  # noqa: E712
            Alert.resolved_at.is_(None),
        ]
        if filter_params.escalation_level_min is not None:
            alert_filters.append(Alert.escalation_level >= filter_params.escalation_level_min)

        alerts_subquery = select(func.count(Alert.id)).where(and_(*alert_filters)).scalar_subquery()

        if filter_params.has_open_alerts is True or filter_params.escalation_level_min is not None:
            conditions.append(alerts_subquery > 0)
        elif filter_params.has_open_alerts is False:
            conditions.append(alerts_subquery == 0)

    # Text search across reference_number, issuing_bank, institution name
    if filter_params.text:
        term = f"%{filter_params.text.strip()}%"
        conditions.append(
            or_(
                Instrument.reference_number.ilike(term),
                Instrument.issuing_bank.ilike(term),
                Institution.name.ilike(term),
            )
        )

    if conditions:
        query = query.where(and_(*conditions))

    # CRITICAL: Always apply institution scoping last
    query = scope_to_institution(query, user, Instrument)

    # Ordering
    sort_col = SORT_COLUMNS.get(filter_params.sort_by, Instrument.created_at)
    if filter_params.sort_dir == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return query
