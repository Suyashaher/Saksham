"""Automatic instrument validation rules and OCR hook interface."""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.db.models.instrument import Instrument

_MANDATORY_FIELDS = ("reference_number", "issuing_bank", "amount", "issue_date", "maturity_date")
_REFERENCE_RE = re.compile(r"^[A-Za-z0-9\-/]+$")


@dataclass
class ValidationIssue:
    """A single validation problem."""

    field: str
    code: str
    message: str
    severity: str  # "ERROR" or "WARNING"


async def validate_instrument(
    session: AsyncSession,
    data: dict,
    instrument_id: uuid.UUID | None = None,
) -> list[ValidationIssue]:
    """Run all automatic validation rules against instrument data.

    Returns a list of ValidationIssue instances (may be empty if valid).
    """
    issues: list[ValidationIssue] = []

    # 1. mandatory_fields
    for field in _MANDATORY_FIELDS:
        value = data.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            issues.append(
                ValidationIssue(
                    field=field,
                    code="mandatory_field",
                    message=f"{field} is required",
                    severity="ERROR",
                )
            )

    # 2. amount_positive
    amount = data.get("amount")
    if amount is not None:
        try:
            if Decimal(str(amount)) <= 0:
                issues.append(
                    ValidationIssue(
                        field="amount",
                        code="amount_positive",
                        message="Amount must be greater than zero",
                        severity="ERROR",
                    )
                )
        except Exception:
            issues.append(
                ValidationIssue(
                    field="amount",
                    code="amount_positive",
                    message="Amount is not a valid number",
                    severity="ERROR",
                )
            )

    # 3. reference_format
    reference_number = data.get("reference_number")
    if reference_number and not _REFERENCE_RE.match(str(reference_number)):
        issues.append(
            ValidationIssue(
                field="reference_number",
                code="reference_format",
                message="Reference number must contain only alphanumeric characters, hyphens, and slashes",
                severity="ERROR",
            )
        )

    # Parse dates for remaining checks
    issue_date = data.get("issue_date")
    maturity_date = data.get("maturity_date")
    parsed_issue: date | None = None
    parsed_maturity: date | None = None

    if issue_date is not None:
        parsed_issue = issue_date if isinstance(issue_date, date) else None
        if parsed_issue is None and isinstance(issue_date, str):
            try:
                parsed_issue = date.fromisoformat(issue_date)
            except (ValueError, TypeError):
                pass

    if maturity_date is not None:
        parsed_maturity = maturity_date if isinstance(maturity_date, date) else None
        if parsed_maturity is None and isinstance(maturity_date, str):
            try:
                parsed_maturity = date.fromisoformat(maturity_date)
            except (ValueError, TypeError):
                pass

    # 4. maturity_after_issue
    if parsed_issue and parsed_maturity and parsed_maturity <= parsed_issue:
        issues.append(
            ValidationIssue(
                field="maturity_date",
                code="maturity_after_issue",
                message="Maturity date must be after issue date",
                severity="ERROR",
            )
        )

    # 4b. Bank Guarantee claim period check
    instrument_type = data.get("instrument_type", "FDR")
    claim_expiry = data.get("claim_expiry_date")
    parsed_claim: date | None = None
    if claim_expiry is not None:
        parsed_claim = claim_expiry if isinstance(claim_expiry, date) else None
        if parsed_claim is None and isinstance(claim_expiry, str):
            try:
                parsed_claim = date.fromisoformat(claim_expiry)
            except (ValueError, TypeError):
                pass

    if instrument_type == "BANK_GUARANTEE":
        if parsed_claim and parsed_maturity:
            if parsed_claim < parsed_maturity:
                issues.append(
                    ValidationIssue(
                        field="claim_expiry_date",
                        code="claim_expiry_before_maturity",
                        message="Claim expiry date must be on or after guarantee maturity/expiry date",
                        severity="ERROR",
                    )
                )
            elif (parsed_claim - parsed_maturity).days < 30:
                issues.append(
                    ValidationIssue(
                        field="claim_expiry_date",
                        code="short_claim_period",
                        message="Bank Guarantee claim period is recommended to be at least 30 days beyond maturity",
                        severity="WARNING",
                    )
                )

    # 5. maturity_in_future
    if parsed_maturity and parsed_maturity <= clock.today():
        issues.append(
            ValidationIssue(
                field="maturity_date",
                code="maturity_in_future",
                message="Maturity date must be in the future",
                severity="ERROR",
            )
        )

    # 6. issue_not_future
    if parsed_issue and parsed_issue > clock.today():
        issues.append(
            ValidationIssue(
                field="issue_date",
                code="issue_not_future",
                message="Issue date must not be in the future",
                severity="ERROR",
            )
        )

    # 7. amount_vs_required
    required_amount = data.get("required_amount")
    if amount is not None and required_amount is not None:
        try:
            amt = Decimal(str(amount))
            req = Decimal(str(required_amount))
            if amt < req:
                shortfall = req - amt
                issues.append(
                    ValidationIssue(
                        field="amount",
                        code="amount_vs_required",
                        message=f"Amount is less than required by {shortfall}",
                        severity="ERROR",
                    )
                )
            elif amt > req:
                issues.append(
                    ValidationIssue(
                        field="amount",
                        code="amount_vs_required",
                        message="Amount exceeds the required amount",
                        severity="WARNING",
                    )
                )
        except Exception:
            pass

    # 8. duplicate_detection
    if reference_number and data.get("issuing_bank"):
        query = select(Instrument.id).where(
            Instrument.reference_number == str(reference_number),
            Instrument.issuing_bank == str(data["issuing_bank"]),
        )
        if instrument_id is not None:
            query = query.where(Instrument.id != instrument_id)
        result = await session.execute(query.limit(1))
        if result.scalar_one_or_none() is not None:
            issues.append(
                ValidationIssue(
                    field="reference_number",
                    code="duplicate_detection",
                    message="An instrument with this reference number and issuing bank already exists",
                    severity="ERROR",
                )
            )

    return issues


# ── OCR Hook Interface ───────────────────────────────────────────────────────


class OcrExtractor(ABC):
    """Abstract base for OCR extraction backends."""

    @abstractmethod
    async def extract(self, file_bytes: bytes, content_type: str) -> dict:
        """Extract instrument fields from a document image/PDF."""
        ...


class NullOcrExtractor(OcrExtractor):
    """No-op OCR extractor (returns empty dict)."""

    async def extract(self, file_bytes: bytes, content_type: str) -> dict:
        return {}


def compare_with_declared(extracted: dict, declared: dict) -> list[ValidationIssue]:
    """Compare OCR-extracted fields with declared data.

    Returns WARNING-level issues for each mismatch.
    """
    issues: list[ValidationIssue] = []
    alias_map = {
        "fdr_number": "reference_number",
        "guarantee_number": "reference_number",
        "bank_name": "issuing_bank",
    }
    for key, extracted_value in extracted.items():
        declared_value = declared.get(key)
        if declared_value is None and key in alias_map:
            declared_value = declared.get(alias_map[key])
        if declared_value is not None and str(extracted_value) != str(declared_value):
            issues.append(
                ValidationIssue(
                    field=alias_map.get(key, key),
                    code="ocr_mismatch",
                    message=(
                        f"OCR extracted '{extracted_value}' but declared value is '{declared_value}'"
                    ),
                    severity="WARNING",
                )
            )
    return issues
