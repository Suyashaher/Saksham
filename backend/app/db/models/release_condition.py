"""ReleaseCondition and ReleaseConditionResult models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import ConditionResultEnum


class ReleaseCondition(UUIDMixin, Base):
    """Configurable release condition / checklist item."""

    __tablename__ = "release_conditions"

    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_automatic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    applies_to_request_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    results: Mapped[list["ReleaseConditionResult"]] = relationship(
        back_populates="condition", cascade="all, delete-orphan"
    )


class ReleaseConditionResult(UUIDMixin, Base):
    """Result of evaluating a condition against a release request."""

    __tablename__ = "release_condition_results"
    __table_args__ = (
        UniqueConstraint("request_id", "condition_id", name="uq_condition_result_per_request"),
        Index("ix_condition_result_request", "request_id"),
    )

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("release_requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    condition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("release_conditions.id", ondelete="CASCADE"),
        nullable=False,
    )
    result: Mapped[ConditionResultEnum] = mapped_column(
        SAEnum(ConditionResultEnum, name="conditionresultenum"),
        nullable=False,
    )
    checked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_auto: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    request: Mapped["ReleaseRequest"] = relationship(  # noqa: F821
        back_populates="condition_results"
    )
    condition: Mapped["ReleaseCondition"] = relationship(
        back_populates="results"
    )
    checker: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[checked_by]
    )
