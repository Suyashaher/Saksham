"""Phase 5 tables: release workflow extensions, conditions, partial index and metrics indexes

Revision ID: 005
Revises: 004
Create Date: 2026-10-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, UUID

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New PG enum types
releaserequesttype_enum = ENUM(
    "RELEASE",
    "REFUND",
    name="releaserequesttype",
    create_type=False,
)

officerrecommendation_enum = ENUM(
    "RECOMMEND",
    "NOT_RECOMMEND",
    name="officerrecommendation",
    create_type=False,
)

conditionresultenum_enum = ENUM(
    "PASS",
    "FAIL",
    "NOT_APPLICABLE",
    name="conditionresultenum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Create new Postgres enum types
    releaserequesttype_enum.create(bind, checkfirst=True)
    officerrecommendation_enum.create(bind, checkfirst=True)
    conditionresultenum_enum.create(bind, checkfirst=True)

    # 2. Extend alertruletype enum with RELEASE_PENDING if not present
    op.execute("ALTER TYPE alertruletype ADD VALUE IF NOT EXISTS 'RELEASE_PENDING'")

    # 3. Add status_before_release_request to instruments
    op.add_column(
        "instruments",
        sa.Column("status_before_release_request", sa.String(50), nullable=True),
    )

    # 4. Add new columns to release_requests
    op.add_column(
        "release_requests",
        sa.Column(
            "request_type",
            releaserequesttype_enum,
            nullable=False,
            server_default="RELEASE",
        ),
    )
    op.add_column(
        "release_requests",
        sa.Column(
            "recommended_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "release_requests",
        sa.Column("recommended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "release_requests",
        sa.Column(
            "officer_recommendation",
            officerrecommendation_enum,
            nullable=True,
        ),
    )
    op.add_column(
        "release_requests",
        sa.Column("officer_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "release_requests",
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "release_requests",
        sa.Column("beneficiary_details", sa.Text(), nullable=True),
    )

    # 5. Partial unique index: only one open release request (PENDING or UNDER_REVIEW) per instrument
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_open_release_request_per_instrument
        ON release_requests (instrument_id)
        WHERE status IN ('PENDING', 'UNDER_REVIEW')
        """
    )

    # 6. Create release_conditions table
    op.create_table(
        "release_conditions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_automatic", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("applies_to_request_type", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_release_conditions_code", "release_conditions", ["code"])

    # 7. Create release_condition_results table
    op.create_table(
        "release_condition_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("release_requests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "condition_id",
            UUID(as_uuid=True),
            sa.ForeignKey("release_conditions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("result", conditionresultenum_enum, nullable=False),
        sa.Column(
            "checked_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_auto", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("request_id", "condition_id", name="uq_condition_result_per_request"),
    )
    op.create_index("ix_condition_result_request", "release_condition_results", ["request_id"])

    # 8. Composite and performance indexes
    op.create_index("ix_instrument_issuing_bank", "instruments", ["issuing_bank"])
    op.create_index(
        "ix_instrument_status_maturity",
        "instruments",
        ["status", "maturity_date"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Drop indexes
    op.drop_index("ix_instrument_status_maturity", table_name="instruments")
    op.drop_index("ix_instrument_issuing_bank", table_name="instruments")
    op.drop_index("ix_condition_result_request", table_name="release_condition_results")
    op.drop_index("ix_release_conditions_code", table_name="release_conditions")
    op.execute("DROP INDEX IF EXISTS uq_open_release_request_per_instrument")

    # Drop tables
    op.drop_table("release_condition_results")
    op.drop_table("release_conditions")

    # Drop columns from release_requests
    op.drop_column("release_requests", "beneficiary_details")
    op.drop_column("release_requests", "withdrawn_at")
    op.drop_column("release_requests", "officer_notes")
    op.drop_column("release_requests", "officer_recommendation")
    op.drop_column("release_requests", "recommended_at")
    op.drop_column("release_requests", "recommended_by")
    op.drop_column("release_requests", "request_type")

    # Drop column from instruments
    op.drop_column("instruments", "status_before_release_request")

    # Drop enum types
    conditionresultenum_enum.drop(bind, checkfirst=True)
    officerrecommendation_enum.drop(bind, checkfirst=True)
    releaserequesttype_enum.drop(bind, checkfirst=True)
