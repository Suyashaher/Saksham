"""Feature extraction for approval-time prediction.

All features come from existing database tables — no new data collection needed.
Feature: escalation_level is EXCLUDED (leakage risk per design doc C.5 note).
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.document_registry import DocumentRegistry
from app.db.models.alert import Alert
from app.db.models.document import Document
from app.db.models.instrument import Instrument
from app.db.models.institution import Institution

logger = logging.getLogger(__name__)

# Amount buckets for categorical encoding
AMOUNT_BUCKETS = [
    (100_000, "small"),
    (500_000, "medium"),
    (2_500_000, "large"),
    (float("inf"), "very_large"),
]


def get_amount_bucket(amount: float) -> str:
    """Classify amount into a bucket."""
    for threshold, label in AMOUNT_BUCKETS:
        if amount <= threshold:
            return label
    return "very_large"


async def extract_features(
    instrument: Instrument, session: AsyncSession
) -> dict:
    """Extract prediction features from an instrument and its related data.

    Returns a dict of feature_name → feature_value.
    """
    features: dict = {}

    # Basic instrument features
    itype = getattr(instrument, "instrument_type", "FDR") or "FDR"
    features["instrument_type"] = itype
    features["amount"] = float(instrument.amount)
    features["amount_bucket"] = get_amount_bucket(float(instrument.amount))

    # Tenure
    if instrument.issue_date and instrument.maturity_date:
        tenure_days = (instrument.maturity_date - instrument.issue_date).days
        features["tenure_months"] = round(tenure_days / 30.44, 1)
    else:
        features["tenure_months"] = 12.0  # default

    # Bank
    features["bank"] = instrument.issuing_bank or "unknown"

    # Institution state
    inst_result = await session.execute(
        select(Institution.state).where(
            Institution.id == instrument.institution_id
        )
    )
    state = inst_result.scalar_one_or_none()
    features["state"] = state or "unknown"

    # Document completeness
    doc_result = await session.execute(
        select(func.count()).select_from(Document).where(
            Document.instrument_id == instrument.id
        )
    )
    n_docs = doc_result.scalar_one()
    features["n_documents"] = n_docs

    required = set(DocumentRegistry.get_required_doc_types(itype))
    present_result = await session.execute(
        select(Document.doc_type).where(
            Document.instrument_id == instrument.id,
            Document.doc_type.in_(required),
        )
    )
    present = {row[0] for row in present_result.all()}
    features["doc_completeness"] = len(present) / max(len(required), 1)
    features["missing_doc_count"] = max(0, len(required) - len(present))

    # Alert count
    alert_result = await session.execute(
        select(func.count()).select_from(Alert).where(
            Alert.instrument_id == instrument.id
        )
    )
    features["n_alerts"] = alert_result.scalar_one()

    # Is renewal
    features["is_renewal"] = instrument.replaces_instrument_id is not None

    # Submission day of week (0=Monday, 6=Sunday)
    features["submission_dow"] = instrument.created_at.weekday() if instrument.created_at else 0

    # Officer workload (number of active cases assigned to same officer)
    if instrument.assigned_officer_id:
        workload_result = await session.execute(
            select(func.count()).select_from(Instrument).where(
                Instrument.assigned_officer_id == instrument.assigned_officer_id,
                Instrument.status.notin_(["RELEASED", "RENEWED"]),
            )
        )
        features["officer_workload"] = workload_result.scalar_one()
    else:
        features["officer_workload"] = 0

    # Verification method (from latest verification record, if any)
    from app.db.models.verification import VerificationRecord
    vr_result = await session.execute(
        select(VerificationRecord.method).where(
            VerificationRecord.instrument_id == instrument.id
        ).order_by(VerificationRecord.verified_at.desc()).limit(1)
    )
    method = vr_result.scalar_one_or_none()
    features["verification_method"] = method.value if method else "none"

    return features
