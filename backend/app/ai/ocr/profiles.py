"""Per-document-type extraction profiles — defines which fields to extract.

Registry pattern: adding a new document type = adding one ExtractionProfile
entry. No other code changes needed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional

from app.db.enums import DocumentType
from app.ai.ocr.parsers import (
    normalize_bank_name,
    parse_amount,
    parse_beneficiary,
    parse_claim_expiry_date,
    parse_date,
    parse_fdr_number,
    parse_guarantee_number,
    parse_interest_rate,
    parse_tenure_days,
)


@dataclass
class FieldDef:
    """Definition of a single extractable field."""

    name: str
    parser: Callable[[str], object] | None = None
    required: bool = False
    aliases: list[str] = field(default_factory=list)


@dataclass
class ExtractionProfile:
    """Extraction profile for a document type."""

    doc_type: DocumentType
    fields: list[FieldDef]
    description: str = ""


# ── Profiles ────────────────────────────────────────────────────────────────

FDR_SCAN_PROFILE = ExtractionProfile(
    doc_type=DocumentType.FDR_SCAN,
    description="Full FDR certificate — 8 fields",
    fields=[
        FieldDef(
            "fdr_number",
            parser=parse_fdr_number,
            required=True,
            aliases=["fd number", "fdr no", "fd no", "receipt no", "deposit no"],
        ),
        FieldDef(
            "bank_name",
            parser=normalize_bank_name,
            required=True,
            aliases=["bank", "issuing bank", "banker"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=True,
            aliases=["deposit amount", "principal", "fd amount", "amount deposited"],
        ),
        FieldDef(
            "issue_date",
            parser=parse_date,
            required=True,
            aliases=["date of deposit", "deposit date", "opening date", "date of issue"],
        ),
        FieldDef(
            "maturity_date",
            parser=parse_date,
            required=True,
            aliases=["date of maturity", "due date", "maturity"],
        ),
        FieldDef(
            "interest_rate",
            parser=parse_interest_rate,
            required=False,
            aliases=["rate of interest", "roi", "rate", "interest"],
        ),
        FieldDef(
            "tenure",
            parser=parse_tenure_days,
            required=False,
            aliases=["period", "duration", "maturity period", "tenure"],
        ),
        FieldDef(
            "branch",
            parser=None,
            required=False,
            aliases=["branch name", "branch office"],
        ),
    ],
)

DEPOSIT_CONFIRMATION_PROFILE = ExtractionProfile(
    doc_type=DocumentType.DEPOSIT_CONFIRMATION,
    description="Bank deposit confirmation — 4 fields (cross-check source)",
    fields=[
        FieldDef(
            "fdr_number",
            parser=parse_fdr_number,
            required=True,
            aliases=["fd number", "fdr no", "reference"],
        ),
        FieldDef(
            "bank_name",
            parser=normalize_bank_name,
            required=True,
            aliases=["bank", "issuing bank"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=True,
            aliases=["confirmed amount", "deposit amount"],
        ),
        FieldDef(
            "maturity_date",
            parser=parse_date,
            required=False,
            aliases=["maturity", "due date"],
        ),
    ],
)

BANK_LETTER_PROFILE = ExtractionProfile(
    doc_type=DocumentType.BANK_LETTER,
    description="Bank confirmation letter — 4 fields (cross-check source)",
    fields=[
        FieldDef(
            "fdr_number",
            parser=parse_fdr_number,
            required=True,
            aliases=["fd number", "fdr no", "reference"],
        ),
        FieldDef(
            "bank_name",
            parser=normalize_bank_name,
            required=True,
            aliases=["bank", "issuing bank"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=True,
            aliases=["confirmed amount", "deposit amount"],
        ),
        FieldDef(
            "maturity_date",
            parser=parse_date,
            required=False,
            aliases=["maturity", "due date"],
        ),
    ],
)

OTHER_PROFILE = ExtractionProfile(
    doc_type=DocumentType.OTHER,
    description="Generic extraction — 2 fields (best-effort)",
    fields=[
        FieldDef(
            "fdr_number",
            parser=parse_fdr_number,
            required=False,
            aliases=["fd number", "reference"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=False,
            aliases=["amount", "sum"],
        ),
    ],
)

BANK_GUARANTEE_DOCUMENT_PROFILE = ExtractionProfile(
    doc_type=DocumentType.BANK_GUARANTEE_DOCUMENT,
    description="Original Bank Guarantee document — 8 fields",
    fields=[
        FieldDef(
            "reference_number",
            parser=parse_guarantee_number,
            required=True,
            aliases=["guarantee number", "bg number", "bg no", "guarantee no", "fdr_number", "reference"],
        ),
        FieldDef(
            "bank_name",
            parser=normalize_bank_name,
            required=True,
            aliases=["bank", "issuing bank", "guarantor bank"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=True,
            aliases=["guarantee amount", "claim amount", "bg amount", "principal"],
        ),
        FieldDef(
            "issue_date",
            parser=parse_date,
            required=True,
            aliases=["date of issue", "effective date", "opening date"],
        ),
        FieldDef(
            "maturity_date",
            parser=parse_date,
            required=True,
            aliases=["date of expiry", "validity date", "due date", "maturity"],
        ),
        FieldDef(
            "claim_expiry_date",
            parser=parse_claim_expiry_date,
            required=True,
            aliases=["claim expiry date", "claim period", "last date for claim", "claim validity"],
        ),
        FieldDef(
            "beneficiary_name",
            parser=parse_beneficiary,
            required=False,
            aliases=["beneficiary", "in favour of", "favoring", "favoured to"],
        ),
        FieldDef(
            "branch",
            parser=None,
            required=False,
            aliases=["branch name", "branch office"],
        ),
    ],
)

RENEWAL_CERTIFICATE_PROFILE = ExtractionProfile(
    doc_type=DocumentType.RENEWAL_CERTIFICATE,
    description="Renewal FDR / BG Extension Certificate — 6 fields",
    fields=[
        FieldDef(
            "reference_number",
            parser=parse_guarantee_number,
            required=True,
            aliases=["fd number", "fdr no", "bg number", "guarantee no", "reference"],
        ),
        FieldDef(
            "bank_name",
            parser=normalize_bank_name,
            required=True,
            aliases=["bank", "issuing bank"],
        ),
        FieldDef(
            "amount",
            parser=parse_amount,
            required=True,
            aliases=["renewed amount", "extended amount", "deposit amount", "amount"],
        ),
        FieldDef(
            "issue_date",
            parser=parse_date,
            required=True,
            aliases=["renewal date", "extension date", "date of issue", "opening date"],
        ),
        FieldDef(
            "maturity_date",
            parser=parse_date,
            required=True,
            aliases=["extended maturity", "new due date", "maturity date", "due date"],
        ),
        FieldDef(
            "claim_expiry_date",
            parser=parse_claim_expiry_date,
            required=False,
            aliases=["claim expiry", "claim period", "last date for claim"],
        ),
    ],
)


# ── Registry ────────────────────────────────────────────────────────────────

EXTRACTION_PROFILES: dict[DocumentType, ExtractionProfile] = {
    DocumentType.FDR_SCAN: FDR_SCAN_PROFILE,
    DocumentType.DEPOSIT_CONFIRMATION: DEPOSIT_CONFIRMATION_PROFILE,
    DocumentType.BANK_LETTER: BANK_LETTER_PROFILE,
    DocumentType.BANK_GUARANTEE_DOCUMENT: BANK_GUARANTEE_DOCUMENT_PROFILE,
    DocumentType.RENEWAL_CERTIFICATE: RENEWAL_CERTIFICATE_PROFILE,
    DocumentType.OTHER: OTHER_PROFILE,
}


def get_profile(doc_type: str | DocumentType) -> ExtractionProfile | None:
    """Get extraction profile for a document type. Returns None if not found."""
    if isinstance(doc_type, str):
        try:
            doc_type = DocumentType(doc_type)
        except ValueError:
            return None
    return EXTRACTION_PROFILES.get(doc_type)
