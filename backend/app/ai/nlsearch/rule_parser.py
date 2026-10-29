"""
Rule-Based Fallback for Natural Language Search.

When no LLM is available, this module parses common natural-language queries
into InstrumentFilter JSON using regex patterns and keyword matching.

Covers: status filters, bank names, amount ranges, date ranges, state names,
escalation, document status, text search, and common Hinglish patterns.

Returns a dict compatible with InstrumentFilter Pydantic model.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Constants matching the app's enums
# ---------------------------------------------------------------------------

VALID_STATUSES = [
    "SUBMITTED", "UNDER_REVIEW", "VERIFIED", "FLAGGED", "REJECTED",
    "APPROVED", "ACTIVE", "MATURED", "RELEASE_REQUESTED", "RELEASED",
]

BANK_ALIASES: dict[str, str] = {
    "sbi": "State Bank of India",
    "pnb": "Punjab National Bank",
    "bob": "Bank of Baroda",
    "canara": "Canara Bank",
    "hdfc": "HDFC Bank",
    "icici": "ICICI Bank",
    "axis": "Axis Bank",
    "kotak": "Kotak Mahindra Bank",
    "ubi": "Union Bank of India",
    "iob": "Indian Overseas Bank",
    "idbi": "IDBI Bank",
    "boi": "Bank of India",
}

# Indian state name patterns
STATE_NAMES = [
    "Delhi", "Maharashtra", "Tamil Nadu", "Karnataka", "Uttar Pradesh",
    "West Bengal", "Rajasthan", "Gujarat", "Madhya Pradesh", "Kerala",
    "Andhra Pradesh", "Telangana", "Bihar", "Punjab", "Haryana",
    "Odisha", "Jharkhand", "Assam", "Chhattisgarh", "Goa",
    "Himachal Pradesh", "Uttarakhand", "Jammu", "Sikkim", "Meghalaya",
    "Tripura", "Mizoram", "Manipur", "Nagaland", "Arunachal Pradesh",
]

# ---------------------------------------------------------------------------
# Amount parsing helpers
# ---------------------------------------------------------------------------

_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|rupees?)\s*(\d[\d,]*\.?\d*)\s*(lakh|lac|crore|cr|k)?",
    re.IGNORECASE,
)

_PLAIN_AMOUNT = re.compile(
    r"(\d[\d,]*\.?\d*)\s*(lakh|lac|crore|cr|k)",
    re.IGNORECASE,
)


def _parse_amount_value(match) -> Optional[float]:
    """Parse an amount match into a float value."""
    raw = match.group(1).replace(",", "")
    try:
        value = float(raw)
    except ValueError:
        return None

    multiplier_str = match.group(2)
    if multiplier_str:
        mult_lower = multiplier_str.lower()
        if mult_lower in ("lakh", "lac"):
            value *= 100_000
        elif mult_lower in ("crore", "cr"):
            value *= 10_000_000
        elif mult_lower == "k":
            value *= 1_000
    return value


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

def _today() -> date:
    """Current date — uses the app's IST-pinned clock (supports demo mode)."""
    try:
        from app.core import clock
        return clock.today()
    except Exception:
        return date.today()


def _resolve_relative_date(text: str) -> Optional[tuple[date, date]]:
    """Resolve relative date expressions to (from_date, to_date)."""
    text = text.lower().strip()

    today = _today()

    # "last N days/weeks/months"
    m = re.search(r"last\s+(\d+)\s+(day|week|month)s?", text)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if unit == "day":
            return (today - timedelta(days=n), today)
        elif unit == "week":
            return (today - timedelta(weeks=n), today)
        elif unit == "month":
            return (today - timedelta(days=n * 30), today)

    # "this month"
    if "this month" in text:
        return (today.replace(day=1), today)

    # "this year"
    if "this year" in text:
        return (today.replace(month=1, day=1), today)

    # "last month"
    if "last month" in text:
        first_of_this = today.replace(day=1)
        last_of_prev = first_of_this - timedelta(days=1)
        first_of_prev = last_of_prev.replace(day=1)
        return (first_of_prev, last_of_prev)

    # "overdue" / "matured" — matured before today
    if "overdue" in text or "past maturity" in text:
        return (date(2020, 1, 1), today)

    # "maturing in next N days" / "maturing within N days"
    m = re.search(r"matur(?:ing|e|ed)?\s+(?:in|within)\s+(?:next\s+)?(\d+)\s+days?", text)
    if m:
        n = int(m.group(1))
        return (today, today + timedelta(days=n))

    # "instruments maturing in next 30 days" (alternative pattern)
    m = re.search(r"matur\w*\s+(?:in\s+)?next\s+(\d+)\s+days?", text)
    if m:
        n = int(m.group(1))
        return (today, today + timedelta(days=n))

    if "maturing soon" in text or "maturing next month" in text:
        return (today, today + timedelta(days=30))

    return None


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_nl_query(query: str) -> dict[str, Any]:
    """
    Parse a natural-language query into an InstrumentFilter-compatible dict.

    Returns a dict with only the fields that were detected (sparse).
    The caller merges this with defaults and applies scope_to_institution.

    Examples:
        "show all flagged instruments"
            → {"statuses": ["FLAGGED"]}
        "SBI FDRs above 5 lakh"
            → {"banks": ["State Bank of India"], "amount_min": 500000}
        "instruments maturing in next 30 days"
            → {"maturity_from": "...", "maturity_to": "..."}
    """
    q = query.strip()
    q_lower = q.lower()
    result: dict[str, Any] = {}

    # --- 1. Status detection ---
    statuses = _detect_statuses(q_lower)
    if statuses:
        result["statuses"] = statuses

    # --- 2. Bank detection ---
    banks = _detect_banks(q_lower)
    if banks:
        result["banks"] = banks

    # --- 3. Amount range ---
    amount_min, amount_max = _detect_amount_range(q_lower)
    if amount_min is not None:
        result["amount_min"] = amount_min
    if amount_max is not None:
        result["amount_max"] = amount_max

    # --- 4. State detection ---
    states = _detect_states(q_lower)
    if states:
        result["states"] = states

    # --- 4b. Instrument types ---
    itypes = _detect_instrument_types(q_lower)
    if itypes:
        result["instrument_types"] = itypes

    # --- 4c. Missing doc types ---
    missing_docs = _detect_missing_doc_types(q_lower)
    if missing_docs:
        result["missing_doc_types"] = missing_docs

    # --- 5. Date range (maturity / issue) ---
    _detect_date_ranges(q_lower, result)

    # --- 6. Document status ---
    if any(p in q_lower for p in ["missing doc", "incomplete doc", "no document"]):
        result["has_missing_documents"] = True

    # --- 7. Alerts ---
    if any(p in q_lower for p in ["has alert", "with alert", "alert", "flagged"]):
        result["has_open_alerts"] = True

    # --- 8. Escalation level ---
    m = re.search(r"escalat(?:ion|ed)\s*(?:level)?\s*(\d+)", q_lower)
    if m:
        result["escalation_level_min"] = int(m.group(1))
    elif "escalated" in q_lower:
        result["escalation_level_min"] = 1

    # --- 9. Verification tag ---
    if "bank verified" in q_lower or "bank_verified" in q_lower:
        result["verification_tag"] = "BANK_VERIFIED"
    elif "self declared" in q_lower or "self_declared" in q_lower or "unverified" in q_lower:
        result["verification_tag"] = "SELF_DECLARED"

    # --- 10. Sort ---
    if "newest" in q_lower or "recent" in q_lower or "latest" in q_lower:
        result["sort_by"] = "created_at"
        result["sort_dir"] = "desc"
    elif "oldest" in q_lower:
        result["sort_by"] = "created_at"
        result["sort_dir"] = "asc"
    elif "highest amount" in q_lower or "largest" in q_lower or "sorted by amount" in q_lower or "sort by amount" in q_lower:
        result["sort_by"] = "amount"
        result["sort_dir"] = "desc"
    elif "smallest" in q_lower or "lowest amount" in q_lower:
        result["sort_by"] = "amount"
        result["sort_dir"] = "asc"

    # --- 11. Free-text fallback ---
    if not result:
        # If nothing was parsed, use the whole query as text search
        result["text"] = q

    return result


# ---------------------------------------------------------------------------
# Detection helpers
# ---------------------------------------------------------------------------

def _detect_statuses(q: str) -> list[str]:
    """Detect status keywords in query."""
    found = []

    # Map of patterns to statuses
    status_patterns = {
        "submitted": "SUBMITTED",
        "under review": "UNDER_REVIEW",
        "under_review": "UNDER_REVIEW",
        "pending review": "UNDER_REVIEW",
        "verified": "VERIFIED",
        "flagged": "FLAGGED",
        "rejected": "REJECTED",
        "approved": "APPROVED",
        "active": "ACTIVE",
        "matured": "MATURED",
        "release requested": "RELEASE_REQUESTED",
        "release_requested": "RELEASE_REQUESTED",
        "pending release": "RELEASE_REQUESTED",
        "released": "RELEASED",
    }

    for pattern, status in status_patterns.items():
        if pattern in q and status not in found:
            found.append(status)

    return found


def _detect_banks(q: str) -> list[str]:
    """Detect bank names/abbreviations in query."""
    found = []
    for alias, canonical in BANK_ALIASES.items():
        # Word boundary check
        if re.search(r"\b" + re.escape(alias) + r"\b", q):
            if canonical not in found:
                found.append(canonical)

    # Check full names longest first to avoid partial substring collisions
    sorted_canonicals = sorted(set(BANK_ALIASES.values()), key=len, reverse=True)
    temp_q = q
    for canonical in sorted_canonicals:
        pattern = r"\b" + re.escape(canonical.lower()) + r"\b"
        if re.search(pattern, temp_q):
            if canonical not in found:
                found.append(canonical)
            temp_q = re.sub(pattern, " ", temp_q)

    return found


def _detect_amount_range(q: str) -> tuple[Optional[float], Optional[float]]:
    """Detect amount range from query."""
    amount_min = None
    amount_max = None

    # "above/over/more than X lakh"
    m = re.search(r"(?:above|over|more\s+than|greater\s+than|>\s*)\s*(?:rs\.?\s*)?(\d[\d,.]*)\s*(lakh|lac|crore|cr|k)?", q)
    if m:
        amount_min = _parse_amount_value(m)

    # Hinglish: "X lakh se zyada" / "X se upar"
    if amount_min is None:
        m = re.search(r"(\d[\d,.]*)\s*(lakh|lac|crore|cr|k)?\s+se\s+(?:zyada|zyaada|upar|jyada)", q)
        if m:
            amount_min = _parse_amount_value(m)

    # "below/under/less than X lakh"
    m = re.search(r"(?:below|under|less\s+than|<\s*)\s*(?:rs\.?\s*)?(\d[\d,.]*)\s*(lakh|lac|crore|cr|k)?", q)
    if m:
        amount_max = _parse_amount_value(m)

    # "between X and Y lakh"
    m = re.search(
        r"between\s+(?:rs\.?\s*)?(\d[\d,.]*)\s*(lakh|lac|crore|cr|k)?\s+and\s+(?:rs\.?\s*)?(\d[\d,.]*)\s*(lakh|lac|crore|cr|k)?",
        q,
    )
    if m:
        raw1 = m.group(1).replace(",", "")
        mult1 = m.group(2)
        raw2 = m.group(3).replace(",", "")
        mult2 = m.group(4)

        try:
            v1 = float(raw1)
            v2 = float(raw2)
        except ValueError:
            pass
        else:
            if mult1:
                v1 *= {"lakh": 1e5, "lac": 1e5, "crore": 1e7, "cr": 1e7, "k": 1e3}.get(mult1.lower(), 1)
            if mult2:
                v2 *= {"lakh": 1e5, "lac": 1e5, "crore": 1e7, "cr": 1e7, "k": 1e3}.get(mult2.lower(), 1)
            amount_min = v1
            amount_max = v2

    return amount_min, amount_max


def _detect_states(q: str) -> list[str]:
    """Detect Indian state names in query."""
    found = []
    for state in STATE_NAMES:
        if state.lower() in q:
            found.append(state)
    return found


def _detect_date_ranges(q: str, result: dict):
    """Detect and set date range fields in result dict."""
    # Maturity dates
    maturity_range = None
    if any(p in q for p in ["matur", "expir"]):
        maturity_range = _resolve_relative_date(q)
        if maturity_range:
            result["maturity_from"] = maturity_range[0].isoformat()
            result["maturity_to"] = maturity_range[1].isoformat()

    # Issue/submission dates
    if any(p in q for p in ["submitted", "issued", "created", "filed"]):
        issue_range = _resolve_relative_date(q)
        if issue_range:
            result["issue_from"] = issue_range[0].isoformat()
            result["issue_to"] = issue_range[1].isoformat()


def _detect_instrument_types(q: str) -> list[str]:
    """Detect instrument types (FDR vs BANK_GUARANTEE)."""
    found = []
    if any(p in q for p in ["bank guarantee", "bank guarantees", "guarantee", "guarantees"]) or re.search(r"\b(?:bg|bgs)\b", q):
        found.append("BANK_GUARANTEE")
    if any(p in q for p in ["fdr", "fdrs", "fixed deposit", "fixed deposits"]) or re.search(r"\b(?:fd|fds)\b", q):
        found.append("FDR")
    return found


def _detect_missing_doc_types(q: str) -> list[str]:
    """Detect specific missing document types in query."""
    found = []
    if any(p in q for p in ["missing deposit confirmation", "no deposit confirmation", "without deposit confirmation"]):
        found.append("DEPOSIT_CONFIRMATION")
    if any(p in q for p in ["missing fdr scan", "no fdr scan", "missing certificate", "without fdr scan"]):
        found.append("FDR_SCAN")
    if any(p in q for p in ["missing bank letter", "no bank letter", "without bank letter", "missing lien letter"]):
        found.append("BANK_LETTER")
    if any(p in q for p in ["missing guarantee document", "missing bg doc", "without guarantee document"]):
        found.append("BANK_GUARANTEE_DOCUMENT")
    if any(p in q for p in ["missing renewal", "missing extension", "without renewal certificate"]):
        found.append("RENEWAL_CERTIFICATE")
    return found
