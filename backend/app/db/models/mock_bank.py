"""MockBankRegistry — dev-only table seeded with known FDR references for mock verification."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class MockBankRegistry(UUIDMixin, Base):
    __tablename__ = "mock_bank_registry"

    reference_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    issuing_bank: Mapped[str] = mapped_column(String(255), nullable=False)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    maturity_date: Mapped[date] = mapped_column(Date, nullable=False)
    holder_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
