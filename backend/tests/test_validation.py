"""Tests for automatic instrument validation and OCR hook."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.instrument import Instrument
from app.services.validation import (
    NullOcrExtractor,
    OcrExtractor,
    ValidationIssue,
    compare_with_declared,
    validate_instrument,
)


@pytest.mark.asyncio
async def test_validation_mandatory_fields(db_session: AsyncSession):
    """Empty or missing fields must trigger ERROR issues."""
    data = {}
    issues = await validate_instrument(db_session, data)
    errors = [i for i in issues if i.severity == "ERROR"]
    missing_fields = {i.field for i in errors if i.code == "mandatory_field"}
    assert {"reference_number", "issuing_bank", "amount", "issue_date", "maturity_date"}.issubset(
        missing_fields
    )


@pytest.mark.asyncio
async def test_validation_amount_checks(db_session: AsyncSession):
    """Amount <= 0 is an ERROR."""
    data = {
        "reference_number": "FDR-VAL-1",
        "issuing_bank": "SBI",
        "amount": Decimal("-100"),
        "issue_date": date.today() - timedelta(days=10),
        "maturity_date": date.today() + timedelta(days=365),
    }
    issues = await validate_instrument(db_session, data)
    amount_errors = [i for i in issues if i.field == "amount" and i.code == "amount_positive"]
    assert len(amount_errors) == 1


@pytest.mark.asyncio
async def test_validation_reference_format(db_session: AsyncSession):
    """Reference numbers with spaces or special chars should fail."""
    data = {
        "reference_number": "FDR# 123 @INVALID",
        "issuing_bank": "SBI",
        "amount": Decimal("100000"),
        "issue_date": date.today() - timedelta(days=10),
        "maturity_date": date.today() + timedelta(days=365),
    }
    issues = await validate_instrument(db_session, data)
    ref_errors = [i for i in issues if i.code == "reference_format"]
    assert len(ref_errors) == 1


@pytest.mark.asyncio
async def test_validation_date_rules(db_session: AsyncSession):
    """Date logic rules: maturity > issue, maturity > today, issue <= today."""
    today = date.today()

    # Case 1: maturity <= issue
    d1 = {
        "reference_number": "FDR-DATE-1",
        "issuing_bank": "SBI",
        "amount": Decimal("100000"),
        "issue_date": today,
        "maturity_date": today - timedelta(days=1),
    }
    issues1 = await validate_instrument(db_session, d1)
    codes1 = {i.code for i in issues1}
    assert "maturity_after_issue" in codes1
    assert "maturity_in_future" in codes1

    # Case 2: issue date in future
    d2 = {
        "reference_number": "FDR-DATE-2",
        "issuing_bank": "SBI",
        "amount": Decimal("100000"),
        "issue_date": today + timedelta(days=5),
        "maturity_date": today + timedelta(days=365),
    }
    issues2 = await validate_instrument(db_session, d2)
    codes2 = {i.code for i in issues2}
    assert "issue_not_future" in codes2


@pytest.mark.asyncio
async def test_validation_amount_vs_required(db_session: AsyncSession):
    """Amount < required is ERROR with shortfall; amount > required is WARNING."""
    today = date.today()

    # Shortfall -> ERROR
    d_short = {
        "reference_number": "FDR-REQ-1",
        "issuing_bank": "SBI",
        "amount": Decimal("80000"),
        "required_amount": Decimal("100000"),
        "issue_date": today - timedelta(days=10),
        "maturity_date": today + timedelta(days=365),
    }
    issues_short = await validate_instrument(db_session, d_short)
    err = next(i for i in issues_short if i.code == "amount_vs_required")
    assert err.severity == "ERROR"
    assert "20000" in err.message

    # Excess -> WARNING
    d_excess = {
        "reference_number": "FDR-REQ-2",
        "issuing_bank": "SBI",
        "amount": Decimal("120000"),
        "required_amount": Decimal("100000"),
        "issue_date": today - timedelta(days=10),
        "maturity_date": today + timedelta(days=365),
    }
    issues_excess = await validate_instrument(db_session, d_excess)
    warn = next(i for i in issues_excess if i.code == "amount_vs_required")
    assert warn.severity == "WARNING"


@pytest.mark.asyncio
async def test_validation_duplicate_detection(db_session: AsyncSession):
    """Detects duplicate (reference_number, issuing_bank) pair."""
    from sqlalchemy import select
    from app.db.models.institution import Institution

    inst_res = await db_session.execute(select(Institution).limit(1))
    institution = inst_res.scalar_one_or_none()
    if not institution:
        institution = Institution(
            id=uuid.uuid4(),
            name="Test Institution",
            aicte_id="TEST-INST-001",
            state="Delhi",
            contact_email="test@inst.ac.in",
            contact_phone="011-12345678",
            approval_cycle="2025-2026",
        )
        db_session.add(institution)
        await db_session.flush()

    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=institution.id,
        reference_number="FDR-DUP-1",
        issuing_bank="State Bank of India",
        amount=Decimal("500000"),
        issue_date=today - timedelta(days=30),
        maturity_date=today + timedelta(days=365),
    )
    db_session.add(inst)
    await db_session.flush()

    new_data = {
        "reference_number": "FDR-DUP-1",
        "issuing_bank": "State Bank of India",
        "amount": Decimal("500000"),
        "issue_date": today - timedelta(days=10),
        "maturity_date": today + timedelta(days=365),
    }
    issues = await validate_instrument(db_session, new_data)
    dup_errors = [i for i in issues if i.code == "duplicate_detection"]
    assert len(dup_errors) == 1

    # But if checking the same instrument (updating itself), no error
    issues_self = await validate_instrument(db_session, new_data, instrument_id=inst.id)
    dup_self = [i for i in issues_self if i.code == "duplicate_detection"]
    assert len(dup_self) == 0


@pytest.mark.asyncio
async def test_ocr_hook_interface():
    """NullOcrExtractor returns empty dict; fake extractor detects mismatches."""
    null_extractor = NullOcrExtractor()
    extracted = await null_extractor.extract(b"dummy pdf bytes", "application/pdf")
    assert extracted == {}

    # Custom fake extractor
    class FakeOcrExtractor(OcrExtractor):
        async def extract(self, file_bytes: bytes, content_type: str) -> dict:
            return {"amount": "100000", "reference_number": "FDR-OCR-999"}

    fake = FakeOcrExtractor()
    results = await fake.extract(b"content", "application/pdf")

    # Mismatch with declared
    declared = {"amount": "200000", "reference_number": "FDR-OCR-999"}
    mismatches = compare_with_declared(results, declared)
    assert len(mismatches) == 1
    assert mismatches[0].field == "amount"
    assert mismatches[0].severity == "WARNING"
    assert "OCR extracted '100000'" in mismatches[0].message
