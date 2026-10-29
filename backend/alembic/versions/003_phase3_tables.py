"""Phase 3 tables: status history, observations, mock bank registry, instrument columns

Revision ID: 003
Revises: 002
Create Date: 2026-10-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Re-use existing PG enum — do NOT create it again
fdrstatus_enum = ENUM(
    "SUBMITTED",
    "UNDER_SCRUTINY",
    "VERIFIED",
    "DISCREPANCY",
    "ACTIVE",
    "EXPIRING",
    "MATURED",
    "RENEWED",
    "RELEASE_REQUESTED",
    "RELEASED",
    name="fdrstatus",
    create_type=False,
)


def upgrade() -> None:
    # -- instrument_status_history --
    op.create_table(
        "instrument_status_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instrument_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", fdrstatus_enum, nullable=True),
        sa.Column("to_status", fdrstatus_enum, nullable=False),
        sa.Column(
            "changed_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_status_history_instrument_id",
        "instrument_status_history",
        ["instrument_id"],
    )

    # -- scrutiny_observations --
    op.create_table(
        "scrutiny_observations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instrument_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "observer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="INFO"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_observations_instrument_id",
        "scrutiny_observations",
        ["instrument_id"],
    )

    # -- mock_bank_registry --
    op.create_table(
        "mock_bank_registry",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("reference_number", sa.String(100), unique=True, nullable=False),
        sa.Column("issuing_bank", sa.String(255), nullable=False),
        sa.Column("branch", sa.String(255), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("maturity_date", sa.Date, nullable=False),
        sa.Column("holder_name", sa.String(255), nullable=False),
        sa.Column("is_valid", sa.Boolean, nullable=False, server_default=sa.text("true")),
    )

    # -- add columns to instruments --
    op.add_column("instruments", sa.Column("validation_flags", JSONB, nullable=True))
    op.add_column(
        "instruments",
        sa.Column(
            "assigned_officer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("instruments", "assigned_officer_id")
    op.drop_column("instruments", "validation_flags")
    op.drop_table("mock_bank_registry")
    op.drop_index("ix_observations_instrument_id", table_name="scrutiny_observations")
    op.drop_table("scrutiny_observations")
    op.drop_index(
        "ix_status_history_instrument_id", table_name="instrument_status_history"
    )
    op.drop_table("instrument_status_history")
