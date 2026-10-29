"""Institution model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

import uuid


class Institution(UUIDMixin, Base):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    aicte_id: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    approval_cycle: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    users: Mapped[list["User"]] = relationship(back_populates="institution")  # noqa: F821
    instruments: Mapped[list["Instrument"]] = relationship(  # noqa: F821
        back_populates="institution"
    )
