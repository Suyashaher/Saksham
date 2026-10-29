"""Seed mock_bank_registry with test data for bank verification."""

from __future__ import annotations

import asyncio
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.mock_bank import MockBankRegistry
from app.db.session import async_session_factory


MOCK_BANK_ENTRIES = [
    # Matching entries (will verify correctly)
    {
        "reference_number": "FDR-SBI-2025-001",
        "issuing_bank": "State Bank of India",
        "branch": "Parliament Street, New Delhi",
        "amount": Decimal("2500000.00"),
        "issue_date": date(2025, 1, 15),
        "maturity_date": date(2028, 1, 15),
        "holder_name": "Delhi Technological University",
        "is_valid": True,
    },
    {
        "reference_number": "FDR-PNB-2025-002",
        "issuing_bank": "Punjab National Bank",
        "branch": "Connaught Place, New Delhi",
        "amount": Decimal("1500000.00"),
        "issue_date": date(2025, 3, 1),
        "maturity_date": date(2028, 3, 1),
        "holder_name": "College of Engineering Pune",
        "is_valid": True,
    },
    {
        "reference_number": "FDR-BOB-2025-003",
        "issuing_bank": "Bank of Baroda",
        "branch": "MG Road, Mumbai",
        "amount": Decimal("3000000.00"),
        "issue_date": date(2025, 6, 1),
        "maturity_date": date(2028, 6, 1),
        "holder_name": "IIT Bombay",
        "is_valid": True,
    },
    # Mismatched entries (will trigger discrepancy)
    {
        "reference_number": "FDR-SBI-2025-MISMATCH",
        "issuing_bank": "State Bank of India",
        "branch": "Nehru Place, New Delhi",
        "amount": Decimal("2000000.00"),  # Institution may claim 2500000
        "issue_date": date(2025, 2, 1),
        "maturity_date": date(2028, 2, 1),
        "holder_name": "Test Mismatch College",
        "is_valid": True,
    },
    {
        "reference_number": "FDR-PNB-2025-WRONG-DATE",
        "issuing_bank": "Punjab National Bank",
        "branch": "Sector 17, Chandigarh",
        "amount": Decimal("1800000.00"),
        "issue_date": date(2025, 4, 15),  # Institution may claim different date
        "maturity_date": date(2027, 4, 15),  # Shorter maturity than claimed
        "holder_name": "Date Mismatch Institute",
        "is_valid": True,
    },
    # Invalid entry
    {
        "reference_number": "FDR-INVALID-001",
        "issuing_bank": "State Bank of India",
        "branch": "Test Branch",
        "amount": Decimal("500000.00"),
        "issue_date": date(2024, 1, 1),
        "maturity_date": date(2027, 1, 1),
        "holder_name": "Invalid FDR Institute",
        "is_valid": False,
    },
    # Bank Guarantee Entries
    {
        "reference_number": "BG-HDFC-2025-001",
        "issuing_bank": "HDFC Bank",
        "branch": "Fort Branch, Mumbai",
        "amount": Decimal("2500000.00"),
        "issue_date": date(2025, 2, 10),
        "maturity_date": date(2028, 2, 10),
        "holder_name": "Delhi Technological University",
        "is_valid": True,
    },
    {
        "reference_number": "BG-SBI-2025-002",
        "issuing_bank": "State Bank of India",
        "branch": "Parliament Street, New Delhi",
        "amount": Decimal("3500000.00"),
        "issue_date": date(2025, 3, 15),
        "maturity_date": date(2028, 3, 15),
        "holder_name": "College of Engineering Pune",
        "is_valid": True,
    },
    {
        "reference_number": "BG-AXIS-2025-MISMATCH",
        "issuing_bank": "Axis Bank",
        "branch": "MG Road, Bangalore",
        "amount": Decimal("2000000.00"),
        "issue_date": date(2025, 5, 1),
        "maturity_date": date(2028, 5, 1),
        "holder_name": "Test Mismatch Institute",
        "is_valid": True,
    },
]


async def seed_mock_bank_registry(session: AsyncSession | None = None) -> None:
    """Seed mock bank registry entries. Idempotent — skips existing."""
    close_session = False
    if session is None:
        session = async_session_factory()
        close_session = True

    try:
        for entry_data in MOCK_BANK_ENTRIES:
            result = await session.execute(
                select(MockBankRegistry).where(
                    MockBankRegistry.reference_number == entry_data["reference_number"]
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  [SKIP] Mock bank entry '{entry_data['reference_number']}' already exists")
                continue

            entry = MockBankRegistry(id=uuid.uuid4(), **entry_data)
            session.add(entry)
            print(f"  [OK] Created mock bank entry: {entry_data['reference_number']}")

        await session.commit()
        print(f"\n[OK] Seeded {len(MOCK_BANK_ENTRIES)} mock bank registry entries")
    finally:
        if close_session:
            await session.close()


if __name__ == "__main__":
    asyncio.run(seed_mock_bank_registry())
