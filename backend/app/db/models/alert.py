"""Alert model — scheduled notifications and escalation tracking."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import AlertStatus


class Alert(UUIDMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "escalation_level >= 0 AND escalation_level <= 2",
            name="ck_alert_escalation_level",
        ),
        # Idempotency: one alert per (instrument, rule, recipient, channel, target date, level)
        UniqueConstraint(
            "instrument_id",
            "rule_id",
            "recipient_user_id",
            "channel",
            "scheduled_for",
            "escalation_level",
            name="uq_alert_idempotency",
        ),
    )

    instrument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("instruments.id", ondelete="CASCADE"),
        nullable=False,
    )
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Phase 4 extended fields
    rule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alert_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    # The calendar date this alert targets (e.g. maturity date or scan date)
    scheduled_for: Mapped[date | None] = mapped_column(Date, nullable=True)
    # When the alert should be delivered (created_at for immediate; future for scheduled)
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[AlertStatus] = mapped_column(
        SAEnum(AlertStatus, name="alertstatus"),
        default=AlertStatus.PENDING,
        nullable=False,
    )
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Self-referential: parent alert this was escalated from
    parent_alert_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alerts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Legacy column kept for backward compatibility (use resolved_at IS NOT NULL now)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # relationships
    instrument: Mapped["Instrument"] = relationship(  # noqa: F821
        back_populates="alerts"
    )
    recipient: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[recipient_user_id]
    )
    acknowledger: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[acknowledged_by]
    )
    rule: Mapped["AlertRule | None"] = relationship(  # noqa: F821
        back_populates="alerts", foreign_keys=[rule_id]
    )
    parent_alert: Mapped["Alert | None"] = relationship(
        remote_side="Alert.id", foreign_keys=[parent_alert_id]
    )
    child_alerts: Mapped[list["Alert"]] = relationship(
        foreign_keys=[parent_alert_id], back_populates="parent_alert"
    )
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        back_populates="alert"
    )
