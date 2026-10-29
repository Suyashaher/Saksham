"""Tests for Phase CR: Multi-Instrument and Complete Document Type Support."""

from __future__ import annotations

import datetime
from decimal import Decimal
import pytest
from httpx import AsyncClient

from app.core.document_registry import DocumentRegistry
from app.db.enums import DocumentType, InstrumentType, UserRole, FDRStatus
from app.services.validation import validate_instrument, ValidationIssue
from app.ai.ocr.profiles import get_profile
from app.ai.ocr.parsers import (
    parse_guarantee_number,
    parse_claim_expiry_date,
    parse_beneficiary,
)
from app.ai.nlsearch.rule_parser import parse_nl_query


def test_document_registry_definitions():
    """Verify document registry has all 7 required document types with correct metadata."""
    meta = DocumentRegistry.get_api_metadata()
    assert len(meta["document_types"]) == 7

    codes = [d["code"] for d in meta["document_types"]]
    expected_codes = [
        "FDR_SCAN",
        "BANK_GUARANTEE_DOCUMENT",
        "DEPOSIT_CONFIRMATION",
        "BANK_LETTER",
        "RENEWAL_CERTIFICATE",
        "CLOSURE",
        "OTHER",
    ]
    for exp in expected_codes:
        assert exp in codes

    # Check FDR required types
    fdr_req = DocumentRegistry.get_required_doc_types("FDR")
    assert "FDR_SCAN" in fdr_req
    assert "DEPOSIT_CONFIRMATION" in fdr_req
    assert "BANK_GUARANTEE_DOCUMENT" not in fdr_req

    # Check Bank Guarantee required types
    bg_req = DocumentRegistry.get_required_doc_types("BANK_GUARANTEE")
    assert "BANK_GUARANTEE_DOCUMENT" in bg_req
    assert "BANK_LETTER" in bg_req
    assert "FDR_SCAN" not in bg_req


def test_document_registry_permissions():
    """Verify permission and stage rules."""
    # FDR_SCAN allowed for INSTITUTION on SUBMITTED
    allowed, _ = DocumentRegistry.is_doc_type_allowed(
        "FDR", "FDR_SCAN", UserRole.INSTITUTION, FDRStatus.SUBMITTED
    )
    assert allowed

    # BANK_GUARANTEE_DOCUMENT not allowed for FDR instrument
    allowed, _ = DocumentRegistry.is_doc_type_allowed(
        "FDR", "BANK_GUARANTEE_DOCUMENT", UserRole.INSTITUTION, FDRStatus.SUBMITTED
    )
    assert not allowed

    # BANK_GUARANTEE_DOCUMENT allowed for BANK_GUARANTEE
    allowed, _ = DocumentRegistry.is_doc_type_allowed(
        "BANK_GUARANTEE", "BANK_GUARANTEE_DOCUMENT", UserRole.INSTITUTION, FDRStatus.SUBMITTED
    )
    assert allowed

    # CLOSURE is only allowed for AICTE officers on RELEASED status
    allowed, _ = DocumentRegistry.is_doc_type_allowed(
        "FDR", "CLOSURE", UserRole.INSTITUTION, FDRStatus.ACTIVE
    )
    assert not allowed

    allowed, _ = DocumentRegistry.is_doc_type_allowed(
        "FDR", "CLOSURE", UserRole.APPROVING_AUTHORITY, FDRStatus.RELEASED
    )
    assert allowed


@pytest.mark.asyncio
async def test_validation_bg_claim_expiry(db_session):
    """Validate claim expiry date rules for Bank Guarantee instruments."""
    today = datetime.date.today()
    issue_date = today - datetime.timedelta(days=30)
    maturity_date = today + datetime.timedelta(days=365)

    # 1. Claim expiry before maturity -> ERROR
    bad_claim_data = {
        "reference_number": "BG-TEST-001",
        "instrument_type": "BANK_GUARANTEE",
        "issuing_bank": "State Bank of India",
        "amount": Decimal("1000000"),
        "issue_date": issue_date,
        "maturity_date": maturity_date,
        "claim_expiry_date": maturity_date - datetime.timedelta(days=5),
        "beneficiary_name": "AICTE",
    }
    issues = await validate_instrument(db_session, bad_claim_data)
    errors = [i for i in issues if i.severity == "ERROR" and i.field == "claim_expiry_date"]
    assert len(errors) == 1
    assert errors[0].code == "claim_expiry_before_maturity"

    # 2. Claim expiry less than 30 days after maturity -> WARNING
    short_claim_data = {
        "reference_number": "BG-TEST-002",
        "instrument_type": "BANK_GUARANTEE",
        "issuing_bank": "State Bank of India",
        "amount": Decimal("1000000"),
        "issue_date": issue_date,
        "maturity_date": maturity_date,
        "claim_expiry_date": maturity_date + datetime.timedelta(days=15),
        "beneficiary_name": "AICTE",
    }
    issues = await validate_instrument(db_session, short_claim_data)
    warnings = [i for i in issues if i.severity == "WARNING" and i.field == "claim_expiry_date"]
    assert len(warnings) == 1
    assert warnings[0].code == "short_claim_period"

    # 3. Valid claim expiry (>= 30 days after maturity) -> No claim expiry issues
    valid_claim_data = {
        "reference_number": "BG-TEST-003",
        "instrument_type": "BANK_GUARANTEE",
        "issuing_bank": "State Bank of India",
        "amount": Decimal("1000000"),
        "issue_date": issue_date,
        "maturity_date": maturity_date,
        "claim_expiry_date": maturity_date + datetime.timedelta(days=60),
        "beneficiary_name": "AICTE",
    }
    issues = await validate_instrument(db_session, valid_claim_data)
    claim_issues = [i for i in issues if i.field == "claim_expiry_date"]
    assert len(claim_issues) == 0


def test_ocr_bg_parsers_and_profiles():
    """Verify OCR parsing and profile for BANK_GUARANTEE_DOCUMENT."""
    # Parsers
    assert parse_guarantee_number("Bank Guarantee No: BG-HDFC-2025-001") == "BG-HDFC-2025-001"
    assert parse_guarantee_number("Ref: 0012BGR0001234") == "0012BGR0001234"
    assert parse_claim_expiry_date("Claim Period Expiry: 15/08/2027") == datetime.date(2027, 8, 15)
    assert parse_beneficiary("In favour of All India Council for Technical Education") == "AICTE"
    assert parse_beneficiary("Beneficiary: AICTE, New Delhi") == "AICTE"

    # Profile lookup
    bg_profile = get_profile(DocumentType.BANK_GUARANTEE_DOCUMENT)
    assert bg_profile is not None
    field_names = [f.name for f in bg_profile.fields]
    assert "reference_number" in field_names
    assert "bank_name" in field_names
    assert "amount" in field_names
    assert "claim_expiry_date" in field_names
    assert "beneficiary_name" in field_names

    renewal_profile = get_profile(DocumentType.RENEWAL_CERTIFICATE)
    assert renewal_profile is not None
    r_fields = [f.name for f in renewal_profile.fields]
    assert "reference_number" in r_fields
    assert "maturity_date" in r_fields


def test_nl_search_instrument_types():
    """Verify NL search extracts instrument_types and missing_doc_types."""
    res1 = parse_nl_query("bank guarantees from State Bank of India")
    assert res1.get("instrument_types") == ["BANK_GUARANTEE"]
    assert res1.get("banks") == ["State Bank of India"]

    res2 = parse_nl_query("all active BGs above 10 lakh")
    assert res2.get("instrument_types") == ["BANK_GUARANTEE"]
    assert "ACTIVE" in res2.get("statuses", [])
    assert res2.get("amount_min") == 1000000

    res3 = parse_nl_query("bank guarantees missing bank letter")
    assert res3.get("instrument_types") == ["BANK_GUARANTEE"]
    assert res3.get("missing_doc_types") == ["BANK_LETTER"]

    res4 = parse_nl_query("instruments missing deposit confirmation")
    assert res4.get("missing_doc_types") == ["DEPOSIT_CONFIRMATION"]


@pytest.mark.asyncio
async def test_meta_document_types_api(client: AsyncClient):
    """Test GET /meta/document-types endpoint."""
    resp = await client.get("/meta/document-types")
    assert resp.status_code == 200
    data = resp.json()
    assert "document_types" in data
    assert "instrument_types" in data
    assert len(data["document_types"]) == 7
    itypes = [it["type"] for it in data["instrument_types"]]
    assert "FDR" in itypes
    assert "BANK_GUARANTEE" in itypes
