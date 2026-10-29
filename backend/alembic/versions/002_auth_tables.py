"""auth tables and audit append-only trigger

Revision ID: 002
Revises: 001
Create Date: 2026-10-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── otp_challenges ───────────────────────────────────
    op.create_table(
        "otp_challenges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("otp_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_otp_challenges_user_created", "otp_challenges", ["user_id", sa.text("created_at DESC")])

    # ── refresh_tokens ───────────────────────────────────
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti", sa.String(255), nullable=False, unique=True),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=True)
    op.create_index("ix_refresh_tokens_user_revoked", "refresh_tokens", ["user_id", "is_revoked"])

    # ── failed_login_attempts ────────────────────────────
    op.create_table(
        "failed_login_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_failed_login_email_time", "failed_login_attempts", ["email", "attempted_at"])

    # ── Append-only trigger on audit_logs ────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only: % not allowed', TG_OP;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_logs_no_update
            BEFORE UPDATE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    """)
    op.execute("""
        CREATE TRIGGER trg_audit_logs_no_delete
            BEFORE DELETE ON audit_logs
            FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    """)


def downgrade() -> None:
    # Drop triggers first
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_mutation();")

    # Drop tables
    op.drop_table("failed_login_attempts")
    op.drop_table("refresh_tokens")
    op.drop_table("otp_challenges")
