"""Instrument (FDR / Security Deposit) model."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import FDRStatus, VerificationTag


class Instrument(UUIDMixin, Base):
    __tablename__ = "instruments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_instrument_amount_positive"),
        CheckConstraint(
            "maturity_date > issue_date", name="ck_instrument_maturity_after_issue"
        ),
        CheckConstraint(
            "instrument_type != 'BANK_GUARANTEE' OR claim_expiry_date IS NULL OR claim_expiry_date >= maturity_date",
            name="ck_instrument_bg_claim_expiry",
        ),
        Index("ix_instrument_maturity_date", "maturity_date"),
        Index("ix_instrument_status", "status"),
        Index("ix_instrument_institution_id", "institution_id"),
        Index("ix_instrument_issuing_bank", "issuing_bank"),
        Index("ix_instrument_status_maturity", "status", "maturity_date"),
    )

    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("institutions.id", ondelete="CASCADE"),
        nullable=False,
    )
    reference_number: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    issuing_bank: Mapped[str] = mapped_column(String(255), nullable=False)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    required_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=False)
    validity_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    verification_tag: Mapped[VerificationTag] = mapped_column(
        SAEnum(VerificationTag, name="verificationtag"),
        nullable=False,
        server_default=VerificationTag.SELF_DECLARED.value,
    )
    status: Mapped[FDRStatus] = mapped_column(
        SAEnum(FDRStatus, name="fdrstatus"),
        nullable=False,
        server_default=FDRStatus.SUBMITTED.value,
    )
    replaces_instrument_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Phase 3: validation warnings and officer assignment
    validation_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    assigned_officer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Phase 5: status tracking before release request
    status_before_release_request: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    # Phase 7B: instrument type discriminator
    instrument_type: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="FDR"
    )

    # Change Request: Bank Guarantee specific fields
    claim_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    beneficiary_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, server_default="AICTE"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=True,
    )

    # relationships
    institution: Mapped["Institution"] = relationship(  # noqa: F821
        back_populates="instruments"
    )
    replaced_by: Mapped["Instrument | None"] = relationship(
        remote_side="Instrument.id", foreign_keys=[replaces_instrument_id]
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        back_populates="instrument"
    )
    verification_records: Mapped[list["VerificationRecord"]] = relationship(  # noqa: F821
        back_populates="instrument"
    )
    release_requests: Mapped[list["ReleaseRequest"]] = relationship(  # noqa: F821
        back_populates="instrument"
    )
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        back_populates="instrument"
    )
    status_history: Mapped[list["InstrumentStatusHistory"]] = relationship(  # noqa: F821
        back_populates="instrument", order_by="InstrumentStatusHistory.changed_at"
    )
    observations: Mapped[list["ScrutinyObservation"]] = relationship(  # noqa: F821
        back_populates="instrument", order_by="ScrutinyObservation.created_at"
    )
    assigned_officer: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[assigned_officer_id]
    )
