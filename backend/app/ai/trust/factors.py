"""Trust Score factor definitions — 10 transparent, rule-based factors.

Each factor computes a normalized score (0.0 to 1.0) and provides a
human-readable reason explaining why it scored that way.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.document_registry import DocumentRegistry
from app.db.enums import FDRStatus, VerificationTag
from app.db.models.alert import Alert
from app.db.models.document import Document
from app.db.models.instrument import Instrument
from app.db.models.renewal import RenewalLink
from app.db.models.ai_models import OcrRun

logger = logging.getLogger(__name__)

# Scheduled / major public-sector banks
_SCHEDULED_BANKS = {
    "State Bank of India", "Punjab National Bank", "Bank of Baroda",
    "Canara Bank", "Union Bank of India", "Bank of India",
    "Indian Overseas Bank", "Central Bank of India", "Indian Bank",
    "UCO Bank", "Bank of Maharashtra", "Punjab & Sind Bank", "IDBI Bank",
    "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
    "Yes Bank", "IndusInd Bank", "Federal Bank",
}

_COOP_KEYWORDS = {"co-op", "cooperative", "coop", "sahakari", "nagar"}


@dataclass
class FactorResult:
    """Result of computing a single trust factor."""

    name: str
    raw_value: float | str
    normalized: float  # 0.0 to 1.0
    reason: str
    weight: float = 0.0
    contribution: float = 0.0


async def compute_document_completeness(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 1: Are all required documents present?"""
    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    required = set(DocumentRegistry.get_required_doc_types(itype))

    result = await session.execute(
        select(Document.doc_type).where(
            Document.instrument_id == instrument.id
        )
    )
    present = {row[0] for row in result.all()}
    missing = required - present

    if not missing:
        return FactorResult(
            name="document_completeness",
            raw_value="all present",
            normalized=1.0,
            reason=f"All required documents uploaded for {itype}",
        )
    elif len(missing) < len(required):
        return FactorResult(
            name="document_completeness",
            raw_value=f"missing: {', '.join(sorted(missing))}",
            normalized=0.5,
            reason=f"Missing documents: {', '.join(sorted(missing))}",
        )
    else:
        return FactorResult(
            name="document_completeness",
            raw_value="none present",
            normalized=0.0,
            reason=f"No required documents uploaded (requires {', '.join(sorted(required))})",
        )


async def compute_ocr_match(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 2: Do OCR-extracted values match declared values?"""
    result = await session.execute(
        select(OcrRun)
        .where(OcrRun.instrument_id == instrument.id)
        .order_by(OcrRun.extracted_at.desc())
        .limit(1)
    )
    latest_ocr = result.scalar_one_or_none()

    if latest_ocr is None:
        return FactorResult(
            name="ocr_match",
            raw_value="not yet run",
            normalized=0.5,
            reason="OCR has not been run on this instrument's documents",
        )

    if latest_ocr.mismatch_count == 0:
        return FactorResult(
            name="ocr_match",
            raw_value="all match",
            normalized=1.0,
            reason="All OCR-extracted fields match declared values",
        )
    elif latest_ocr.mismatch_count <= 2:
        return FactorResult(
            name="ocr_match",
            raw_value=f"{latest_ocr.mismatch_count} minor mismatches",
            normalized=0.5,
            reason=f"{latest_ocr.mismatch_count} minor mismatch(es) between OCR and declared values",
        )
    else:
        return FactorResult(
            name="ocr_match",
            raw_value=f"{latest_ocr.mismatch_count} mismatches",
            normalized=0.0,
            reason=f"{latest_ocr.mismatch_count} critical mismatches between OCR and declared values",
        )


async def compute_bank_verification(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 3: Bank verification status and method quality."""
    if instrument.verification_tag == VerificationTag.BANK_VERIFIED:
        return FactorResult(
            name="bank_verification",
            raw_value="BANK_VERIFIED",
            normalized=1.0,
            reason="Instrument is bank-verified",
        )

    # Check if there's a QR verification attempt
    from app.db.models.verification import VerificationRecord
    from app.db.enums import VerificationMethod

    vr_result = await session.execute(
        select(VerificationRecord).where(
            VerificationRecord.instrument_id == instrument.id,
            VerificationRecord.method == VerificationMethod.QR,
        ).limit(1)
    )
    has_qr = vr_result.scalar_one_or_none() is not None

    if has_qr:
        return FactorResult(
            name="bank_verification",
            raw_value="SELF_DECLARED+QR",
            normalized=0.5,
            reason="Self-declared but has QR verification attempt",
        )

    return FactorResult(
        name="bank_verification",
        raw_value="SELF_DECLARED",
        normalized=0.0,
        reason="Instrument is self-declared with no verification",
    )


async def compute_amount_reasonableness(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 4: Is the amount within institutional norms?"""
    # Get average amount for this institution
    result = await session.execute(
        select(func.avg(Instrument.amount)).where(
            Instrument.institution_id == instrument.institution_id,
            Instrument.id != instrument.id,
        )
    )
    avg_amount = result.scalar_one_or_none()

    if avg_amount is None or avg_amount == 0:
        return FactorResult(
            name="amount_reasonableness",
            raw_value="no baseline",
            normalized=1.0,
            reason="No historical data to compare (first instrument for this institution)",
        )

    ratio = float(instrument.amount) / float(avg_amount)
    if 0.3 <= ratio <= 3.0:
        return FactorResult(
            name="amount_reasonableness",
            raw_value=f"ratio={ratio:.2f}",
            normalized=1.0,
            reason=f"Amount is within normal range for this institution (ratio: {ratio:.1f}x of average)",
        )
    elif 0.1 <= ratio <= 5.0:
        return FactorResult(
            name="amount_reasonableness",
            raw_value=f"ratio={ratio:.2f}",
            normalized=0.5,
            reason=f"Amount is unusual for this institution ({ratio:.1f}x of average)",
        )
    else:
        return FactorResult(
            name="amount_reasonableness",
            raw_value=f"ratio={ratio:.2f}",
            normalized=0.0,
            reason=f"Amount is a significant outlier ({ratio:.1f}x of institutional average)",
        )


async def compute_date_consistency(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 5: Are dates internally consistent?"""
    if instrument.issue_date >= instrument.maturity_date:
        return FactorResult(
            name="date_consistency",
            raw_value="impossible",
            normalized=0.0,
            reason="Issue date is after or equal to maturity date — impossible",
        )

    tenure = (instrument.maturity_date - instrument.issue_date).days
    if tenure < 30:
        return FactorResult(
            name="date_consistency",
            raw_value=f"tenure={tenure}d",
            normalized=0.5,
            reason=f"Very short tenure ({tenure} days) — unusual for instrument",
        )

    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    if itype == "BANK_GUARANTEE" and instrument.claim_expiry_date:
        if instrument.claim_expiry_date < instrument.maturity_date:
            return FactorResult(
                name="date_consistency",
                raw_value="invalid claim date",
                normalized=0.0,
                reason="Claim expiry date is before maturity date",
            )
        claim_period = (instrument.claim_expiry_date - instrument.maturity_date).days
        if claim_period < 30:
            return FactorResult(
                name="date_consistency",
                raw_value=f"short_claim={claim_period}d",
                normalized=0.7,
                reason=f"Claim period is only {claim_period} days beyond maturity (recommended >= 30 days)",
            )

    return FactorResult(
        name="date_consistency",
        raw_value=f"tenure={tenure}d",
        normalized=1.0,
        reason=f"Dates are consistent (tenure: {tenure} days)",
    )


async def compute_alert_count(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 6: Number of open/unresolved alerts."""
    from app.db.enums import AlertStatus

    result = await session.execute(
        select(func.count()).select_from(Alert).where(
            Alert.instrument_id == instrument.id,
            Alert.status == AlertStatus.PENDING,
        )
    )
    count = result.scalar_one()

    if count == 0:
        return FactorResult(
            name="alert_count", raw_value=0, normalized=1.0,
            reason="No open alerts",
        )
    elif count == 1:
        return FactorResult(
            name="alert_count", raw_value=1, normalized=0.5,
            reason="1 open alert on this instrument",
        )
    else:
        return FactorResult(
            name="alert_count", raw_value=count, normalized=0.0,
            reason=f"{count} open alerts on this instrument",
        )


async def compute_cross_doc_consistency(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 7: Do primary document and confirmation document agree?"""
    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    if itype == "BANK_GUARANTEE":
        check_docs = ["BANK_GUARANTEE_DOCUMENT", "BANK_LETTER"]
        doc_label = "BANK_GUARANTEE_DOCUMENT and BANK_LETTER"
    else:
        check_docs = ["FDR_SCAN", "DEPOSIT_CONFIRMATION"]
        doc_label = "FDR_SCAN and DEPOSIT_CONFIRMATION"

    result = await session.execute(
        select(Document.doc_type).where(
            Document.instrument_id == instrument.id,
            Document.doc_type.in_(check_docs),
        )
    )
    doc_types = {row[0] for row in result.all()}

    if len(doc_types) < 2:
        return FactorResult(
            name="cross_doc_consistency",
            raw_value="insufficient docs",
            normalized=0.5,
            reason=f"Not enough documents to cross-check (need {doc_label})",
        )

    # Check OCR runs for cross-doc mismatches
    ocr_result = await session.execute(
        select(OcrRun.mismatch_count).where(
            OcrRun.instrument_id == instrument.id,
        )
    )
    total_mismatches = sum(row[0] for row in ocr_result.all())

    if total_mismatches == 0:
        return FactorResult(
            name="cross_doc_consistency",
            raw_value="match",
            normalized=1.0,
            reason=f"{doc_label} values are consistent",
        )
    else:
        return FactorResult(
            name="cross_doc_consistency",
            raw_value=f"{total_mismatches} mismatches",
            normalized=0.0,
            reason=f"Cross-document inconsistency: {total_mismatches} mismatch(es)",
        )


async def compute_renewal_chain(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 8: Is the renewal chain intact?"""
    if instrument.replaces_instrument_id is None:
        return FactorResult(
            name="renewal_chain_integrity",
            raw_value="n/a",
            normalized=1.0,
            reason="Not a renewal — no chain to verify",
        )

    # Verify the predecessor exists
    result = await session.execute(
        select(Instrument.id).where(
            Instrument.id == instrument.replaces_instrument_id
        )
    )
    predecessor = result.scalar_one_or_none()

    if predecessor is None:
        return FactorResult(
            name="renewal_chain_integrity",
            raw_value="broken",
            normalized=0.0,
            reason="Renewal chain broken — predecessor instrument not found",
        )

    # Check renewal link record
    link_result = await session.execute(
        select(RenewalLink).where(
            RenewalLink.new_instrument_id == instrument.id
        ).limit(1)
    )
    link = link_result.scalar_one_or_none()

    if link is None:
        return FactorResult(
            name="renewal_chain_integrity",
            raw_value="missing link",
            normalized=0.5,
            reason="Renewal link record is missing",
        )

    if link.renewed_after_maturity:
        return FactorResult(
            name="renewal_chain_integrity",
            raw_value="late renewal",
            normalized=0.5,
            reason="Renewed after maturity (late renewal)",
        )

    return FactorResult(
        name="renewal_chain_integrity",
        raw_value="valid",
        normalized=1.0,
        reason="Renewal chain is intact and timely",
    )


async def compute_response_timeliness(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 9: How quickly does the institution respond to queries?"""
    from app.db.models.status_history import InstrumentStatusHistory

    # Check how long the instrument stayed in DISCREPANCY status
    result = await session.execute(
        select(InstrumentStatusHistory).where(
            InstrumentStatusHistory.instrument_id == instrument.id,
            InstrumentStatusHistory.from_status == FDRStatus.DISCREPANCY,
        ).order_by(InstrumentStatusHistory.changed_at.desc()).limit(1)
    )
    history = result.scalar_one_or_none()

    if history is None:
        return FactorResult(
            name="response_timeliness",
            raw_value="n/a",
            normalized=0.5,
            reason="No discrepancy resolution history to evaluate",
        )

    # Find when DISCREPANCY was entered
    entry_result = await session.execute(
        select(InstrumentStatusHistory).where(
            InstrumentStatusHistory.instrument_id == instrument.id,
            InstrumentStatusHistory.to_status == FDRStatus.DISCREPANCY,
        ).order_by(InstrumentStatusHistory.changed_at.desc()).limit(1)
    )
    entry = entry_result.scalar_one_or_none()

    if entry is None:
        return FactorResult(
            name="response_timeliness",
            raw_value="n/a",
            normalized=0.5,
            reason="Discrepancy entry timestamp not found",
        )

    days_in_discrepancy = (history.changed_at - entry.changed_at).days

    if days_in_discrepancy <= 3:
        return FactorResult(
            name="response_timeliness",
            raw_value=f"{days_in_discrepancy}d",
            normalized=1.0,
            reason=f"Institution responded to discrepancy in {days_in_discrepancy} day(s)",
        )
    elif days_in_discrepancy <= 7:
        return FactorResult(
            name="response_timeliness",
            raw_value=f"{days_in_discrepancy}d",
            normalized=0.5,
            reason=f"Institution took {days_in_discrepancy} days to respond to discrepancy",
        )
    else:
        return FactorResult(
            name="response_timeliness",
            raw_value=f"{days_in_discrepancy}d",
            normalized=0.0,
            reason=f"Institution took {days_in_discrepancy} days to respond — exceeds 7-day threshold",
        )


async def compute_bank_reputation(
    instrument: Instrument, session: AsyncSession
) -> FactorResult:
    """Factor 10: Bank classification (scheduled/co-op/unknown)."""
    bank = instrument.issuing_bank or ""

    if bank in _SCHEDULED_BANKS:
        return FactorResult(
            name="bank_reputation",
            raw_value="scheduled",
            normalized=1.0,
            reason=f"{bank} is a major scheduled bank",
        )

    bank_lower = bank.lower()
    if any(kw in bank_lower for kw in _COOP_KEYWORDS):
        return FactorResult(
            name="bank_reputation",
            raw_value="cooperative",
            normalized=0.5,
            reason=f"{bank} appears to be a cooperative bank",
        )

    return FactorResult(
        name="bank_reputation",
        raw_value="unknown",
        normalized=0.5,
        reason=f"Bank '{bank}' is not in the scheduled bank registry — cannot verify classification",
    )


# ── Factor Registry ─────────────────────────────────────────────────────────

ALL_FACTORS = [
    compute_document_completeness,
    compute_ocr_match,
    compute_bank_verification,
    compute_amount_reasonableness,
    compute_date_consistency,
    compute_alert_count,
    compute_cross_doc_consistency,
    compute_renewal_chain,
    compute_response_timeliness,
    compute_bank_reputation,
]
