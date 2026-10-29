"""Phase 4 tables: alert_rules, extended alerts, notifications, renewal_links patch

Revision ID: 004
Revises: 003
Create Date: 2026-10-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, UUID

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New PG enum types (create_type=True — they do not exist yet)
alertruletype_enum = ENUM(
    "MATURITY_REMINDER",
    "OVERDUE_MATURED",
    "STALE_VERIFICATION",
    "DISCREPANCY_UNRESOLVED",
    name="alertruletype",
    create_type=True,
)
alertchannel_enum = ENUM(
    "EMAIL",
    "SMS",
    "IN_APP",
    name="alertchannel",
    create_type=True,
)
alertstatus_enum = ENUM(
    "PENDING",
    "SENT",
    "FAILED",
    name="alertstatus",
    create_type=True,
)
# userrole already exists — reference only
userrole_enum = ENUM(
    "INSTITUTION",
    "VERIFYING_OFFICER",
    "APPROVING_AUTHORITY",
    "ADMIN",
    name="userrole",
    create_type=False,
)


def upgrade() -> None:
    # ── 1. Create alert_rules table ─────────────────────────────────────────
    alertruletype_enum.create(op.get_bind(), checkfirst=True)
    alertstatus_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "alert_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("rule_type", alertruletype_enum, nullable=False),
        sa.Column("days", sa.Integer, nullable=False),
        sa.Column("channels", ARRAY(sa.String(20)), nullable=False, server_default="{}"),
        sa.Column("recipient_role", userrole_enum, nullable=False),
        sa.Column("escalate_after_days", sa.Integer, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_alert_rule_name"),
    )

    # ── 2. Extend alerts table ───────────────────────────────────────────────
    op.add_column(
        "alerts",
        sa.Column(
            "rule_id",
            UUID(as_uuid=True),
            sa.ForeignKey("alert_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "alerts",
        sa.Column("scheduled_for", sa.Date, nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column(
            "status",
            alertstatus_enum,
            nullable=False,
            server_default="PENDING",
        ),
    )
    op.add_column(
        "alerts",
        sa.Column("failure_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column(
        "alerts",
        sa.Column("last_error", sa.Text, nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column(
            "acknowledged_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "alerts",
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column("resolved_reason", sa.String(500), nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column(
            "parent_alert_id",
            UUID(as_uuid=True),
            sa.ForeignKey("alerts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # Idempotency unique constraint — NULL-safe via COALESCE handled by partial index approach;
    # we use a standard unique constraint (NULLs are not equal in SQL unique, so two rows with
    # rule_id=NULL would not conflict — for Phase 4 rule_id will always be set for new alerts).
    op.create_unique_constraint(
        "uq_alert_idempotency",
        "alerts",
        [
            "instrument_id",
            "rule_id",
            "recipient_user_id",
            "channel",
            "scheduled_for",
            "escalation_level",
        ],
    )

    # ── 3. Create notifications table ────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "alert_id",
            UUID(as_uuid=True),
            sa.ForeignKey("alerts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    # ── 4. Extend renewal_links — add renewed_after_maturity ─────────────────
    op.add_column(
        "renewal_links",
        sa.Column(
            "renewed_after_maturity",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    # Reverse in reverse order
    op.drop_column("renewal_links", "renewed_after_maturity")

    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_constraint("uq_alert_idempotency", "alerts", type_="unique")
    for col in [
        "parent_alert_id",
        "resolved_reason",
        "resolved_at",
        "acknowledged_at",
        "acknowledged_by",
        "last_error",
        "failure_count",
        "status",
        "scheduled_for",
        "rule_id",
    ]:
        op.drop_column("alerts", col)

    op.drop_table("alert_rules")

    alertstatus_enum.drop(op.get_bind(), checkfirst=True)
    alertruletype_enum.drop(op.get_bind(), checkfirst=True)
