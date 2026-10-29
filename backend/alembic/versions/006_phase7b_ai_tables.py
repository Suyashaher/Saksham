"""Phase 7B: AI tables, BANK_LETTER doc type, instrument_type, feedback extensions

Revision ID: 006
Revises: 005
Create Date: 2026-10-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Default trust score weights (version 1) — design doc Section B.3
DEFAULT_WEIGHTS = [
    ("document_completeness", 20, "All required documents present"),
    ("ocr_match", 15, "OCR extracted values match declared values"),
    ("bank_verification", 20, "Bank verification status and method quality"),
    ("amount_reasonableness", 10, "Amount within institutional norms"),
    ("date_consistency", 10, "Issue/maturity dates and tenure are consistent"),
    ("alert_count", 10, "Number of open alerts on instrument"),
    ("cross_doc_consistency", 5, "FDR_SCAN matches DEPOSIT_CONFIRMATION"),
    ("renewal_chain_integrity", 5, "Renewal chain links are intact"),
    ("response_timeliness", 3, "Institution response time to queries"),
    ("bank_reputation", 2, "Bank classification (scheduled/co-op/unknown)"),
]


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Extend DocumentType enum with BANK_LETTER if PG enum type exists
    has_enum = bind.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = 'documenttype'")
    ).scalar()
    if has_enum:
        op.execute("ALTER TYPE documenttype ADD VALUE IF NOT EXISTS 'BANK_LETTER'")

    # 2. Add instrument_type to instruments (default FDR for existing rows)
    op.add_column(
        "instruments",
        sa.Column(
            "instrument_type",
            sa.String(50),
            nullable=False,
            server_default="FDR",
        ),
    )
    op.create_index(
        "ix_instrument_instrument_type", "instruments", ["instrument_type"]
    )

    # 3. Extend feedback_labels with Phase 7B columns
    op.add_column(
        "feedback_labels",
        sa.Column("model_version", sa.String(100), nullable=True),
    )
    op.add_column(
        "feedback_labels",
        sa.Column("input_snapshot", JSONB, nullable=True),
    )
    op.add_column(
        "feedback_labels",
        sa.Column("correction", JSONB, nullable=True),
    )
    op.add_column(
        "feedback_labels",
        sa.Column("verdict_detail", sa.String(100), nullable=True),
    )
    op.add_column(
        "feedback_labels",
        sa.Column(
            "feedback_source",
            sa.String(50),
            nullable=True,
            server_default="manual",
        ),
    )

    # 4. Create trust_score_weights table
    op.create_table(
        "trust_score_weights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("factor_name", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "approved_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "effective_from",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_trust_score_weights_active",
        "trust_score_weights",
        ["version", "is_active"],
    )

    # 5. Create trust_score_snapshots table
    op.create_table(
        "trust_score_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instrument_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("band", sa.String(20), nullable=False),
        sa.Column("factor_breakdown", JSONB, nullable=False),
        sa.Column("weights_version", sa.Integer(), nullable=False),
        sa.Column(
            "model_version",
            sa.String(100),
            nullable=False,
            server_default="v1.0-rule-based",
        ),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_trust_score_snapshots_instrument",
        "trust_score_snapshots",
        ["instrument_id"],
    )
    op.create_index(
        "ix_trust_score_snapshots_computed",
        "trust_score_snapshots",
        ["computed_at"],
    )

    # 6. Create prediction_snapshots table
    op.create_table(
        "prediction_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instrument_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("predicted_days", sa.Float(), nullable=False),
        sa.Column("interval_low", sa.Float(), nullable=True),
        sa.Column("interval_high", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "is_heuristic",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("model_version", sa.String(100), nullable=False),
        sa.Column(
            "data_source",
            sa.String(50),
            nullable=False,
            server_default="synthetic",
        ),
        sa.Column("features_snapshot", JSONB, nullable=True),
        sa.Column(
            "predicted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_prediction_snapshots_instrument",
        "prediction_snapshots",
        ["instrument_id"],
    )

    # 7. Create ai_models registry table
    op.create_table(
        "ai_models",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("model_name", sa.String(200), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column(
            "stage",
            sa.String(50),
            nullable=False,
            server_default="staging",
        ),
        sa.Column("artifact_path", sa.String(500), nullable=True),
        sa.Column("metrics", JSONB, nullable=True),
        sa.Column(
            "data_source",
            sa.String(50),
            nullable=False,
            server_default="synthetic",
        ),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "approved_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "registered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "model_name", "version", name="uq_ai_model_name_version"
        ),
    )

    # 8. Create ocr_runs table (metadata only — no extracted text)
    op.create_table(
        "ocr_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "instrument_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("doc_type", sa.String(100), nullable=False),
        sa.Column(
            "engine", sa.String(100), nullable=False, server_default="tesseract"
        ),
        sa.Column("engine_version", sa.String(50), nullable=True),
        sa.Column("languages", sa.String(50), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("per_field_confidence", JSONB, nullable=True),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column(
            "mismatch_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "extracted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ocr_runs_document", "ocr_runs", ["document_id"])
    op.create_index("ix_ocr_runs_instrument", "ocr_runs", ["instrument_id"])

    # 9. Create nl_search_log table
    op.create_table(
        "nl_search_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("query_redacted", sa.Text(), nullable=False),
        sa.Column("parsed_filter", JSONB, nullable=True),
        sa.Column("method", sa.String(50), nullable=False),
        sa.Column(
            "result_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "searched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_nl_search_log_user", "nl_search_log", ["user_id"])
    op.create_index(
        "ix_nl_search_log_searched_at", "nl_search_log", ["searched_at"]
    )

    # 10. Seed default trust score weights (version 1)
    import uuid as _uuid

    for factor_name, weight, description in DEFAULT_WEIGHTS:
        op.execute(
            sa.text(
                """
                INSERT INTO trust_score_weights
                    (id, version, factor_name, weight, description, is_active)
                VALUES
                    (:id, 1, :factor_name, :weight, :description, true)
                """
            ).bindparams(
                id=str(_uuid.uuid4()),
                factor_name=factor_name,
                weight=weight,
                description=description,
            )
        )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index("ix_nl_search_log_searched_at", table_name="nl_search_log")
    op.drop_index("ix_nl_search_log_user", table_name="nl_search_log")
    op.drop_table("nl_search_log")

    op.drop_index("ix_ocr_runs_instrument", table_name="ocr_runs")
    op.drop_index("ix_ocr_runs_document", table_name="ocr_runs")
    op.drop_table("ocr_runs")

    op.drop_table("ai_models")

    op.drop_index(
        "ix_prediction_snapshots_instrument", table_name="prediction_snapshots"
    )
    op.drop_table("prediction_snapshots")

    op.drop_index(
        "ix_trust_score_snapshots_computed", table_name="trust_score_snapshots"
    )
    op.drop_index(
        "ix_trust_score_snapshots_instrument",
        table_name="trust_score_snapshots",
    )
    op.drop_table("trust_score_snapshots")

    op.drop_index(
        "ix_trust_score_weights_active", table_name="trust_score_weights"
    )
    op.drop_table("trust_score_weights")

    # Drop feedback_labels extensions
    op.drop_column("feedback_labels", "feedback_source")
    op.drop_column("feedback_labels", "verdict_detail")
    op.drop_column("feedback_labels", "correction")
    op.drop_column("feedback_labels", "input_snapshot")
    op.drop_column("feedback_labels", "model_version")

    # Drop instrument_type
    op.drop_index("ix_instrument_instrument_type", table_name="instruments")
    op.drop_column("instruments", "instrument_type")

    # Note: Cannot remove BANK_LETTER from documenttype enum in PG
    # (enum values cannot be removed without recreating the type)
