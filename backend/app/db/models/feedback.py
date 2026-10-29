"""FeedbackLabel model — human-in-the-loop labels on AI outputs."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import OfficerVerdict


class FeedbackLabel(UUIDMixin, Base):
    __tablename__ = "feedback_labels"

    ai_feature: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ai_output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    officer_verdict: Mapped[OfficerVerdict] = mapped_column(
        SAEnum(OfficerVerdict, name="officerverdict"), nullable=False
    )
    labelled_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Phase 7B extensions ─────────────────────────────────────────────────────
    model_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    correction: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    verdict_detail: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # "too_high", "too_low", "wrong_field", "correct"
    feedback_source: Mapped[str | None] = mapped_column(
        String(50), nullable=True, server_default="manual"
    )  # "manual" or "outcome"

    # relationships
    labeller: Mapped["User | None"] = relationship(foreign_keys=[labelled_by])  # noqa: F821
