"""AlertRule model — configurable rule that drives the monitoring scan."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin
from app.db.enums import AlertRuleType, UserRole


class AlertRule(UUIDMixin, Base):
    __tablename__ = "alert_rules"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    rule_type: Mapped[AlertRuleType] = mapped_column(
        SAEnum(AlertRuleType, name="alertruletype"), nullable=False
    )
    # For MATURITY_REMINDER: days before maturity date.
    # For stale/overdue types: days the instrument has been in that state.
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    # e.g. ["EMAIL", "IN_APP"]
    channels: Mapped[list[str]] = mapped_column(
        ARRAY(String(20)), nullable=False, default=list
    )
    recipient_role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole", create_type=False), nullable=False
    )
    # If set, escalate to next level after this many days of no acknowledgment
    escalate_after_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # relationships
    alerts: Mapped[list["Alert"]] = relationship(  # noqa: F821
        back_populates="rule", foreign_keys="Alert.rule_id"
    )
