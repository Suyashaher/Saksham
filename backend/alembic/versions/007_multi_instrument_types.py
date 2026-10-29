"""Change Request: multi-instrument types, Bank Guarantee claim period, and beneficiary

Revision ID: 007
Revises: 006
Create Date: 2026-10-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add claim_expiry_date and beneficiary_name to instruments
    op.add_column(
        "instruments",
        sa.Column("claim_expiry_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "instruments",
        sa.Column(
            "beneficiary_name",
            sa.String(255),
            nullable=True,
            server_default="AICTE",
        ),
    )

    # 2. Backfill existing rows with default beneficiary
    op.execute(
        "UPDATE instruments SET beneficiary_name = 'AICTE' WHERE beneficiary_name IS NULL"
    )

    # 3. Add check constraint ensuring claim period extends to or past maturity for BG
    op.create_check_constraint(
        "ck_instrument_bg_claim_expiry",
        "instruments",
        "instrument_type != 'BANK_GUARANTEE' OR claim_expiry_date IS NULL OR claim_expiry_date >= maturity_date",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_instrument_bg_claim_expiry",
        "instruments",
        type_="check",
    )
    op.drop_column("instruments", "beneficiary_name")
    op.drop_column("instruments", "claim_expiry_date")
