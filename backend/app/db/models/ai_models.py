"""AI-owned database models — Phase 7B.

These tables are the ONLY tables that AI code may write to
(plus validation_flags as WARNINGs). AI code must NEVER write to
instruments, verification_records, release_requests, or other core tables.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin


class TrustScoreWeight(UUIDMixin, Base):
    """Versioned, admin-editable trust score weights."""

    __tablename__ = "trust_score_weights"

    version: Mapped[int] = mapped_column(Integer, nullable=False)
    factor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    effective_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    approver: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[approved_by]
    )


class TrustScoreSnapshot(UUIDMixin, Base):
    """Immutable snapshot of a computed trust score for audit trail."""

    __tablename__ = "trust_score_snapshots"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    band: Mapped[str] = mapped_column(String(20), nullable=False)
    factor_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False)
    weights_version: Mapped[int] = mapped_column(Integer, nullable=False)
    model_version: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="v1.0-rule-based"
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PredictionSnapshot(UUIDMixin, Base):
    """Immutable snapshot of an approval-time prediction."""

    __tablename__ = "prediction_snapshots"

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "verification" or "release"
    predicted_days: Mapped[float] = mapped_column(Float, nullable=False)
    interval_low: Mapped[float | None] = mapped_column(Float, nullable=True)
    interval_high: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_heuristic: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    data_source: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="synthetic"
    )
    features_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    predicted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AIModel(UUIDMixin, Base):
    """Registry mirror of MLflow models — tracks model lifecycle."""

    __tablename__ = "ai_models"

    model_name: Mapped[str] = mapped_column(String(200), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    stage: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="staging"
    )  # staging / production / archived
    artifact_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    data_source: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="synthetic"
    )
    trained_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    approver: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[approved_by]
    )

    __table_args__ = (
        UniqueConstraint("model_name", "version", name="uq_ai_model_name_version"),
    )


class OcrRun(UUIDMixin, Base):
    """Metadata-only record of an OCR extraction run.

    NO extracted text is stored — only field-level confidence scores
    and pipeline metadata for audit and performance tracking.
    """

    __tablename__ = "ocr_runs"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    engine: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="tesseract"
    )
    engine_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    languages: Mapped[str | None] = mapped_column(String(50), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_field_confidence: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    overall_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    mismatch_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    extracted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NLSearchLog(UUIDMixin, Base):
    """Redacted log of NL search queries for analytics and improvement."""

    __tablename__ = "nl_search_log"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    query_redacted: Mapped[str] = mapped_column(
        Text, nullable=False
    )  # no PII — redacted version
    parsed_filter: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    method: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # "llm", "rule_based", "text_search"
    result_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    searched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
