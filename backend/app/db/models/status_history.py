"""InstrumentStatusHistory — tracks every state transition."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import FDRStatus


class InstrumentStatusHistory(UUIDMixin, Base):
    __tablename__ = "instrument_status_history"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[FDRStatus | None] = mapped_column(
        SAEnum(FDRStatus, name="fdrstatus", create_type=False),
        nullable=True,
    )
    to_status: Mapped[FDRStatus] = mapped_column(
        SAEnum(FDRStatus, name="fdrstatus", create_type=False),
        nullable=False,
    )
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        back_populates="status_history"
    )
    changed_by_user: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[changed_by]
    )
