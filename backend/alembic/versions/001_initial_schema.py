"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-10-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── ENUM type definitions ────────────────────────────────
ENUM_FDR_STATUS = ENUM(
    "SUBMITTED", "UNDER_SCRUTINY", "VERIFIED", "DISCREPANCY",
    "ACTIVE", "EXPIRING", "MATURED", "RENEWED",
    "RELEASE_REQUESTED", "RELEASED",
    name="fdrstatus",
    create_type=False,
)
ENUM_VERIFICATION_TAG = ENUM(
    "SELF_DECLARED", "BANK_VERIFIED",
    name="verificationtag",
    create_type=False,
)
ENUM_USER_ROLE = ENUM(
    "INSTITUTION", "VERIFYING_OFFICER", "APPROVING_AUTHORITY", "ADMIN",
    name="userrole",
    create_type=False,
)
ENUM_VERIFICATION_METHOD = ENUM(
    "API", "QR", "LETTER",
    name="verificationmethod",
    create_type=False,
)
ENUM_RELEASE_REQUEST_STATUS = ENUM(
    "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED",
    name="releaserequeststatus",
    create_type=False,
)
ENUM_OFFICER_VERDICT = ENUM(
    "CORRECT", "INCORRECT",
    name="officerverdict",
    create_type=False,
)


def upgrade() -> None:
    # ── Create PG enums explicitly ───────────────────────
    sa.Enum(
        "SUBMITTED", "UNDER_SCRUTINY", "VERIFIED", "DISCREPANCY",
        "ACTIVE", "EXPIRING", "MATURED", "RENEWED",
        "RELEASE_REQUESTED", "RELEASED",
        name="fdrstatus",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "SELF_DECLARED", "BANK_VERIFIED",
        name="verificationtag",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "INSTITUTION", "VERIFYING_OFFICER", "APPROVING_AUTHORITY", "ADMIN",
        name="userrole",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "API", "QR", "LETTER",
        name="verificationmethod",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLOSED",
        name="releaserequeststatus",
    ).create(op.get_bind(), checkfirst=True)

    sa.Enum(
        "CORRECT", "INCORRECT",
        name="officerverdict",
    ).create(op.get_bind(), checkfirst=True)

    # ── institutions ─────────────────────────────────────
    op.create_table(
        "institutions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("aicte_id", sa.String(50), nullable=False, unique=True),
        sa.Column("state", sa.String(100), nullable=False),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(20), nullable=True),
        sa.Column("approval_cycle", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_institutions_aicte_id", "institutions", ["aicte_id"])

    # ── users ────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", ENUM_USER_ROLE, nullable=False),
        sa.Column("institution_id", UUID(as_uuid=True), sa.ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── instruments ──────────────────────────────────────
    op.create_table(
        "instruments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("institution_id", UUID(as_uuid=True), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=False, unique=True),
        sa.Column("issuing_bank", sa.String(255), nullable=False),
        sa.Column("branch", sa.String(255), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("required_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
        sa.Column("validity_status", sa.String(50), nullable=True),
        sa.Column("verification_tag", ENUM_VERIFICATION_TAG, nullable=False, server_default="SELF_DECLARED"),
        sa.Column("status", ENUM_FDR_STATUS, nullable=False, server_default="SUBMITTED"),
        sa.Column("replaces_instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.CheckConstraint("amount > 0", name="ck_instrument_amount_positive"),
        sa.CheckConstraint("maturity_date > issue_date", name="ck_instrument_maturity_after_issue"),
    )
    op.create_index("ix_instrument_reference_number", "instruments", ["reference_number"])
    op.create_index("ix_instrument_maturity_date", "instruments", ["maturity_date"])
    op.create_index("ix_instrument_status", "instruments", ["status"])
    op.create_index("ix_instrument_institution_id", "instruments", ["institution_id"])

    # ── documents ────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("doc_type", sa.String(100), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("uploaded_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── verification_records ─────────────────────────────
    op.create_table(
        "verification_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("method", ENUM_VERIFICATION_METHOD, nullable=False),
        sa.Column("result", sa.Text(), nullable=False),
        sa.Column("verified_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discrepancy_notes", sa.Text(), nullable=True),
    )

    # ── renewal_links ────────────────────────────────────
    op.create_table(
        "renewal_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("old_instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("new_instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("old_instrument_id", "new_instrument_id", name="uq_renewal_link_pair"),
    )

    # ── release_requests ─────────────────────────────────
    op.create_table(
        "release_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", ENUM_RELEASE_REQUEST_STATUS, nullable=False, server_default="PENDING"),
        sa.Column("requested_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decision_notes", sa.Text(), nullable=True),
        sa.Column("closure_document_id", UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── alerts ───────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("instrument_id", UUID(as_uuid=True), sa.ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_name", sa.String(255), nullable=False),
        sa.Column("recipient_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint("escalation_level >= 0 AND escalation_level <= 2", name="ck_alert_escalation_level"),
    )

    # ── audit_logs ───────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("payload", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("prev_hash", sa.Text(), nullable=True),
        sa.Column("hash", sa.Text(), nullable=True),
    )

    # ── feedback_labels ──────────────────────────────────
    op.create_table(
        "feedback_labels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ai_feature", sa.String(255), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("ai_output", JSONB, nullable=True),
        sa.Column("officer_verdict", ENUM_OFFICER_VERDICT, nullable=False),
        sa.Column("labelled_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("feedback_labels")
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("release_requests")
    op.drop_table("renewal_links")
    op.drop_table("verification_records")
    op.drop_table("documents")
    op.drop_table("instruments")
    op.drop_table("users")
    op.drop_table("institutions")

    # Drop PG enums
    ENUM_OFFICER_VERDICT.drop(op.get_bind(), checkfirst=True)
    ENUM_RELEASE_REQUEST_STATUS.drop(op.get_bind(), checkfirst=True)
    ENUM_VERIFICATION_METHOD.drop(op.get_bind(), checkfirst=True)
    ENUM_VERIFICATION_TAG.drop(op.get_bind(), checkfirst=True)
    ENUM_FDR_STATUS.drop(op.get_bind(), checkfirst=True)
    ENUM_USER_ROLE.drop(op.get_bind(), checkfirst=True)
