"""LLM Payload Guard — enforces an allowlist for data sent to external LLMs.

SECURITY INVARIANT: No beneficiary_details, passwords, tokens, OTPs,
raw document bytes, or OCR text may ever be sent to an external LLM or logs.

This guard is called before EVERY LLM API call.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


class PayloadGuardViolation(Exception):
    """Raised when a payload contains blocked fields."""

    def __init__(self, blocked_fields: list[str]) -> None:
        self.blocked_fields = blocked_fields
        super().__init__(
            f"LLM payload guard blocked fields: {', '.join(blocked_fields)}"
        )


# Fields that are ALLOWED to be sent to an external LLM
ALLOWED_FIELDS = {
    # Instrument metadata (non-sensitive)
    "status", "instrument_type", "amount", "issue_date", "maturity_date",
    "issuing_bank", "bank_name", "branch", "reference_number",
    "verification_tag", "validity_status",
    # Institution (public info)
    "institution_name", "institution_id", "state",
    # Scrutiny / validation (structured, non-sensitive)
    "validation_issues", "scrutiny_observations", "observation_text",
    # Query / search
    "query", "search_query", "filter",
    # AI-specific
    "trust_score", "score", "band", "factors",
    "predicted_days", "model_version", "data_source",
    # Letter drafting context
    "letter_type", "issues_list", "deadline_date",
    # Dates and counts
    "today", "days_remaining", "days_overdue", "count",
}

# Fields that are ALWAYS blocked
BLOCKED_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"otp", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"beneficiary", re.IGNORECASE),
    re.compile(r"phone", re.IGNORECASE),
    re.compile(r"email", re.IGNORECASE),
    re.compile(r"document_bytes", re.IGNORECASE),
    re.compile(r"file_bytes", re.IGNORECASE),
    re.compile(r"ocr_text", re.IGNORECASE),
    re.compile(r"raw_text", re.IGNORECASE),
    re.compile(r"extracted_text", re.IGNORECASE),
    re.compile(r"encryption_key", re.IGNORECASE),
    re.compile(r"api_key", re.IGNORECASE),
    re.compile(r"jwt", re.IGNORECASE),
    re.compile(r"refresh_token", re.IGNORECASE),
    re.compile(r"access_token", re.IGNORECASE),
    re.compile(r"cookie", re.IGNORECASE),
    re.compile(r"session_id", re.IGNORECASE),
]


def check_payload(payload: dict, context: str = "") -> dict:
    """Validate and filter a payload before sending to an external LLM.

    Returns the filtered payload with only allowed fields.
    Raises PayloadGuardViolation if explicitly blocked fields are found.
    """
    blocked: list[str] = []
    filtered: dict = {}

    for key, value in payload.items():
        # Check against blocked patterns
        is_blocked = any(pattern.search(key) for pattern in BLOCKED_PATTERNS)
        if is_blocked:
            blocked.append(key)
            continue

        # Check against allowlist
        if key in ALLOWED_FIELDS:
            filtered[key] = value
        else:
            # Unknown fields are silently dropped (logged at debug)
            logger.debug(
                "LLM payload guard dropped unknown field '%s' (context: %s)",
                key, context,
            )

    if blocked:
        raise PayloadGuardViolation(blocked)

    return filtered


def sanitize_for_log(payload: dict) -> dict:
    """Redact sensitive fields from a payload for logging purposes."""
    safe: dict = {}
    for key, value in payload.items():
        is_blocked = any(pattern.search(key) for pattern in BLOCKED_PATTERNS)
        if is_blocked:
            safe[key] = "[REDACTED]"
        elif key in ALLOWED_FIELDS:
            safe[key] = value
        else:
            safe[key] = "[FILTERED]"
    return safe
