"""Domain enums — mirrored as PostgreSQL native ENUM types."""

from __future__ import annotations

import enum


class FDRStatus(str, enum.Enum):
    """Lifecycle status of an FDR / security-deposit instrument."""

    SUBMITTED = "SUBMITTED"
    UNDER_SCRUTINY = "UNDER_SCRUTINY"
    VERIFIED = "VERIFIED"
    DISCREPANCY = "DISCREPANCY"
    ACTIVE = "ACTIVE"
    EXPIRING = "EXPIRING"
    MATURED = "MATURED"
    RENEWED = "RENEWED"
    RELEASE_REQUESTED = "RELEASE_REQUESTED"
    RELEASED = "RELEASED"


class VerificationTag(str, enum.Enum):
    """Whether the instrument data is self-declared or bank-confirmed."""

    SELF_DECLARED = "SELF_DECLARED"
    BANK_VERIFIED = "BANK_VERIFIED"


class UserRole(str, enum.Enum):
    """Roles in the portal."""

    INSTITUTION = "INSTITUTION"
    VERIFYING_OFFICER = "VERIFYING_OFFICER"
    APPROVING_AUTHORITY = "APPROVING_AUTHORITY"
    ADMIN = "ADMIN"


class VerificationMethod(str, enum.Enum):
    """How a verification was performed."""

    API = "API"
    QR = "QR"
    LETTER = "LETTER"


class ReleaseRequestStatus(str, enum.Enum):
    """Status of a request to release an instrument."""

    PENDING = "PENDING"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"


class OfficerVerdict(str, enum.Enum):
    """Human label on an AI prediction."""

    CORRECT = "CORRECT"
    INCORRECT = "INCORRECT"


class AlertEscalationLevel(enum.IntEnum):
    """Alert escalation level: 0 (institution), 1 (verifying officer), 2 (approving authority)."""

    INSTITUTION = 0
    VERIFYING_OFFICER = 1
    APPROVING_AUTHORITY = 2


# ── Phase 4 enums ─────────────────────────────────────────────────────────────


class AlertRuleType(str, enum.Enum):
    """Type of alert rule that drives the monitoring scan."""

    MATURITY_REMINDER = "MATURITY_REMINDER"
    OVERDUE_MATURED = "OVERDUE_MATURED"
    STALE_VERIFICATION = "STALE_VERIFICATION"
    DISCREPANCY_UNRESOLVED = "DISCREPANCY_UNRESOLVED"
    RELEASE_PENDING = "RELEASE_PENDING"


class AlertChannel(str, enum.Enum):
    """Delivery channel for an alert."""

    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"


class AlertStatus(str, enum.Enum):
    """Lifecycle of an individual alert delivery attempt."""

    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


# ── Phase 5 enums ─────────────────────────────────────────────────────────────


class ReleaseRequestType(str, enum.Enum):
    """Type of release request: release or refund."""

    RELEASE = "RELEASE"
    REFUND = "REFUND"


class OfficerRecommendation(str, enum.Enum):
    """Recommendation submitted by the verifying officer."""

    RECOMMEND = "RECOMMEND"
    NOT_RECOMMEND = "NOT_RECOMMEND"


class ConditionResultEnum(str, enum.Enum):
    """Evaluation result of a release condition."""

    PASS = "PASS"
    FAIL = "FAIL"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class DocumentType(str, enum.Enum):
    """Document type categorization."""

    FDR_SCAN = "FDR_SCAN"
    BANK_GUARANTEE_DOCUMENT = "BANK_GUARANTEE_DOCUMENT"
    DEPOSIT_CONFIRMATION = "DEPOSIT_CONFIRMATION"
    BANK_LETTER = "BANK_LETTER"
    RENEWAL_CERTIFICATE = "RENEWAL_CERTIFICATE"
    CLOSURE = "CLOSURE"
    OTHER = "OTHER"


class InstrumentType(str, enum.Enum):
    """Type of financial instrument."""

    FDR = "FDR"
    BANK_GUARANTEE = "BANK_GUARANTEE"


class AIFeature(str, enum.Enum):
    """AI feature identifiers for feedback and logging."""

    OCR_AUTOFILL = "ocr_autofill"
    TRUST_SCORE = "trust_score"
    TIME_PREDICTION = "time_prediction"
    NL_SEARCH = "nl_search"
    CROSS_CHECK = "cross_check"
    LETTER_DRAFT = "letter_draft"


class TrustBand(str, enum.Enum):
    """Trust score risk bands."""

    HIGH = "HIGH"      # 80-100: low risk
    MEDIUM = "MEDIUM"  # 50-79: needs review
    LOW = "LOW"        # 0-49: high priority
