"""RenewalLink model — tracks instrument replacements / renewals."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin


class RenewalLink(UUIDMixin, Base):
    __tablename__ = "renewal_links"
    __table_args__ = (
        UniqueConstraint(
            "old_instrument_id", "new_instrument_id", name="uq_renewal_link_pair"
        ),
    )

    old_instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )
    new_instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # True when the old instrument had already matured before this renewal was linked
    renewed_after_maturity: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # relationships
    old_instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        foreign_keys=[old_instrument_id]
    )
    new_instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        foreign_keys=[new_instrument_id]
    )
