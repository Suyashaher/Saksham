"""ReleaseRequest model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import (
    OfficerRecommendation,
    ReleaseRequestStatus,
    ReleaseRequestType,
)


class ReleaseRequest(UUIDMixin, Base):
    __tablename__ = "release_requests"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ReleaseRequestStatus] = mapped_column(
        SAEnum(ReleaseRequestStatus, name="releaserequeststatus"),
        nullable=False,
        server_default=ReleaseRequestStatus.PENDING.value,
    )
    request_type: Mapped[ReleaseRequestType] = mapped_column(
        SAEnum(ReleaseRequestType, name="releaserequesttype"),
        nullable=False,
        server_default=ReleaseRequestType.RELEASE.value,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decision_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    closure_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Phase 5: Recommendation & Beneficiary details
    recommended_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recommended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    officer_recommendation: Mapped[OfficerRecommendation | None] = mapped_column(
        SAEnum(OfficerRecommendation, name="officerrecommendation"),
        nullable=True,
    )
    officer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    beneficiary_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        back_populates="release_requests"
    )
    requester: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[requested_by]
    )
    decider: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[decided_by]
    )
    recommender: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[recommended_by]
    )
    closure_document: Mapped["Document | None"] = relationship(  # noqa: F821
        foreign_keys=[closure_document_id]
    )
    condition_results: Mapped[list["ReleaseConditionResult"]] = relationship(  # noqa: F821
        back_populates="request", cascade="all, delete-orphan"
    )
