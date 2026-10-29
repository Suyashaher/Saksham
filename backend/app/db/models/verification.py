"""VerificationRecord model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import VerificationMethod


class VerificationRecord(UUIDMixin, Base):
    __tablename__ = "verification_records"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )
    method: Mapped[VerificationMethod] = mapped_column(
        SAEnum(VerificationMethod, name="verificationmethod"), nullable=False
    )
    result: Mapped[str] = mapped_column(Text, nullable=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    discrepancy_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        back_populates="verification_records"
    )
    verifier: Mapped["User | None"] = relationship(foreign_keys=[verified_by])  # noqa: F821
