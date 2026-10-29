"""Tests for bank verification service and mock verifier."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.mock_bank import MockBankRegistry
from app.services.bank_verifier import MockBankVerifier


@pytest.mark.asyncio
async def test_mock_bank_verifier_match(db_session: AsyncSession):
    """When all fields match the registry, matches must be True."""
    reg = MockBankRegistry(
        id=uuid.uuid4(),
        reference_number="FDR-BV-MATCH-001",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("1500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        holder_name="Test College",
        is_valid=True,
    )
    db_session.add(reg)
    await db_session.flush()

    verifier = MockBankVerifier()
    res = await verifier.verify(
        db_session,
        reference_number="FDR-BV-MATCH-001",
        issuing_bank="State Bank of India",
        amount=Decimal("1500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
    )

    assert res.found is True
    assert res.matches is True
    assert res.mismatches == {}
    assert res.raw_response["holder_name"] == "Test College"


@pytest.mark.asyncio
async def test_mock_bank_verifier_mismatches(db_session: AsyncSession):
    """When bank has different amount or dates, mismatches dict is populated."""
    reg = MockBankRegistry(
        id=uuid.uuid4(),
        reference_number="FDR-BV-MISMATCH-002",
        issuing_bank="State Bank of India",
        branch="Main Branch",
        amount=Decimal("1000000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
        holder_name="Test College",
        is_valid=True,
    )
    db_session.add(reg)
    await db_session.flush()

    verifier = MockBankVerifier()
    res = await verifier.verify(
        db_session,
        reference_number="FDR-BV-MISMATCH-002",
        issuing_bank="State Bank of India",
        amount=Decimal("1500000.00"),  # Claimed 1500000, bank has 1000000
        issue_date=date(2025, 1, 1),
        maturity_date=date(2029, 1, 1),  # Claimed 2029, bank has 2028
    )

    assert res.found is True
    assert res.matches is False
    assert "amount" in res.mismatches
    assert "maturity_date" in res.mismatches
    assert res.mismatches["amount"]["expected"] == "1000000.00"
    assert res.mismatches["amount"]["actual"] == "1500000.00"


@pytest.mark.asyncio
async def test_mock_bank_verifier_not_found(db_session: AsyncSession):
    """Unknown reference number returns found=False, matches=False."""
    verifier = MockBankVerifier()
    res = await verifier.verify(
        db_session,
        reference_number="NON-EXISTENT-REF-999",
        issuing_bank="Unknown Bank",
        amount=Decimal("500000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2028, 1, 1),
    )

    assert res.found is False
    assert res.matches is False
    assert res.mismatches == {}
