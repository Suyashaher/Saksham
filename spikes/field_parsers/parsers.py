"""
Field Parsers Spike — Indian-format amount, date, and bank-name parsers.

These parsers handle the messy output of OCR engines:
- Amounts in Indian notation (₹, Rs., INR, lakh, crore, commas in Indian grouping)
- Dates in multiple Indian/international formats
- Bank name normalization against a canonical alias list

All functions return None on un-parseable input (graceful degradation).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

# ---------------------------------------------------------------------------
# A. AMOUNT PARSER
# ---------------------------------------------------------------------------

# Multipliers for Indian-English and Hindi words
_MULTIPLIER_WORDS: dict[str, Decimal] = {
    "lakh":   Decimal("100000"),
    "lakhs":  Decimal("100000"),
    "lac":    Decimal("100000"),
    "lacs":   Decimal("100000"),
    "crore":  Decimal("10000000"),
    "crores": Decimal("10000000"),
    "cr":     Decimal("10000000"),
    "thousand": Decimal("1000"),
    "k":      Decimal("1000"),
    "million": Decimal("1000000"),
    "m":      Decimal("1000000"),
    "billion": Decimal("1000000000"),
    "b":      Decimal("1000000000"),
}

# Indian number words (for "Rupees One Lakh Twenty-Five Thousand Only")
_WORD_VALUES: dict[str, int] = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}

_WORD_MULTIPLIERS: dict[str, int] = {
    "hundred": 100,
    "thousand": 1000,
    "lakh": 100_000,
    "lac": 100_000,
    "crore": 10_000_000,
}

# Currency prefixes to strip
_CURRENCY_RE = re.compile(
    r"^[\s]*(?:₹|rs\.?|inr|rupees?|indian\s+rupees?)[\s.:]*",
    re.IGNORECASE,
)

# "Only" / "only/-" suffix
_ONLY_RE = re.compile(r"[\s]*(?:only|only[/\-]?)[\s.]*$", re.IGNORECASE)

# Whitespace normalization
_WS_RE = re.compile(r"\s+")


def parse_amount(raw: str) -> Optional[Decimal]:
    """
    Parse an Indian-format amount string to a Decimal.

    Handles:
        "₹1,25,000.00"          → 125000.00
        "Rs. 5,00,000"          → 500000
        "INR 1.5 Lakh"          → 150000
        "5 crore"               → 50000000
        "1,25,000.50"           → 125000.50
        "125000"                → 125000
        "Rupees One Lakh Twenty Five Thousand Only"  → 125000
        "12,50,000/-"           → 1250000

    Returns None if parsing fails.
    """
    if not raw or not raw.strip():
        return None

    text = raw.strip()

    # Strip currency prefix
    text = _CURRENCY_RE.sub("", text)
    # Strip "only" / "only/-" suffix
    text = _ONLY_RE.sub("", text)
    # Strip trailing /-
    text = re.sub(r"[/\-]+\s*$", "", text)
    text = text.strip()

    if not text:
        return None

    # --- Path 1: Numeric with optional multiplier word ---
    # E.g. "1.5 Lakh", "5 crore", "1,25,000.50"
    # Try this FIRST because "1.5 lakh" contains "lakh" but isn't word-form.
    numeric_result = _try_parse_amount_numeric(text)
    if numeric_result is not None:
        return numeric_result

    # --- Path 2: Try "words" path (Rupees One Lakh Twenty Five Thousand) ---
    words_result = _try_parse_amount_words(text)
    if words_result is not None:
        return words_result

    return None


def _try_parse_amount_words(text: str) -> Optional[Decimal]:
    """Parse amount expressed in English words (e.g. 'One Lakh Twenty Five Thousand')."""
    words = _WS_RE.split(text.lower().strip())
    # Filter out non-number-word tokens
    cleaned = [w.replace("-", "") for w in words]

    # Quick check: at least one word must be a number word or multiplier
    if not any(w in _WORD_VALUES or w in _WORD_MULTIPLIERS for w in cleaned):
        return None

    # Accumulate the total using standard Indian grouping logic
    try:
        total = 0
        current = 0
        for word in cleaned:
            if word in _WORD_VALUES:
                current += _WORD_VALUES[word]
            elif word in _WORD_MULTIPLIERS:
                mult = _WORD_MULTIPLIERS[word]
                if current == 0:
                    current = 1
                if mult >= 1000:
                    # "lakh", "crore", "thousand" absorb everything accumulated so far
                    total += current * mult
                    current = 0
                else:
                    # "hundred"
                    current *= mult
            # else: skip non-numeric words like "and", "rupees"
        total += current
        if total > 0:
            return Decimal(total)
    except Exception:
        pass
    return None


def _try_parse_amount_numeric(text: str) -> Optional[Decimal]:
    """Parse numeric amount string, with optional multiplier word."""
    text = text.strip()

    # Check for multiplier word at the end
    multiplier = Decimal("1")
    lower = text.lower()
    for word, mult in _MULTIPLIER_WORDS.items():
        if lower.endswith(word):
            text = text[: -len(word)].strip()
            multiplier = mult
            break

    # Remove commas (Indian grouping: 1,25,000 or international: 125,000)
    text = text.replace(",", "")

    # Remove spaces
    text = text.replace(" ", "")

    # Remove stray non-numeric chars except decimal point
    text = re.sub(r"[^\d.]", "", text)

    if not text:
        return None

    try:
        value = Decimal(text) * multiplier
        # Sanity: amount should be positive
        if value <= 0:
            return None
        return value
    except (InvalidOperation, ArithmeticError):
        return None


# ---------------------------------------------------------------------------
# B. DATE PARSER
# ---------------------------------------------------------------------------

_MONTH_NAMES: dict[str, int] = {
    "jan": 1, "january": 1, "feb": 2, "february": 2,
    "mar": 3, "march": 3, "apr": 4, "april": 4,
    "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# Ordinal suffix removal
_ORDINAL_RE = re.compile(r"(\d+)\s*(?:st|nd|rd|th)\b", re.IGNORECASE)

# Date patterns (order matters — more specific first)
_DATE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # ISO: 2026-03-05
    (re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$"), "YMD"),
    # DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    (re.compile(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$"), "DMY"),
    # DD/MM/YY or DD-MM-YY
    (re.compile(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$"), "DMY_SHORT"),
    # DD Mon YYYY (5 Mar 2026, 05-Mar-2026, 5th March 2026)
    (re.compile(
        r"^(\d{1,2})\s*[/\-.\s]\s*([A-Za-z]+)\s*[/\-.\s,]\s*(\d{4})$"
    ), "D_MON_Y"),
    # Mon DD, YYYY (March 5, 2026)
    (re.compile(
        r"^([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})$"
    ), "MON_D_Y"),
    # YYYY/MM/DD
    (re.compile(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$"), "YMD"),
]


def parse_date(raw: str) -> Optional[date]:
    """
    Parse a date string in various Indian and international formats.

    Handles:
        "05/03/2026"           → 2026-03-05  (DD/MM/YYYY, Indian convention)
        "5-Mar-2026"           → 2026-03-05
        "5th March 2026"       → 2026-03-05
        "March 5, 2026"        → 2026-03-05
        "2026-03-05"           → 2026-03-05  (ISO)
        "05.03.2026"           → 2026-03-05
        "05/03/26"             → 2026-03-05

    Returns None if parsing fails.
    """
    if not raw or not raw.strip():
        return None

    text = raw.strip()
    # Remove ordinal suffixes (5th → 5)
    text = _ORDINAL_RE.sub(r"\1", text)
    text = text.strip()

    for pattern, fmt in _DATE_PATTERNS:
        m = pattern.match(text)
        if not m:
            continue

        try:
            if fmt == "YMD":
                y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            elif fmt == "DMY":
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            elif fmt == "DMY_SHORT":
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                y += 2000 if y < 50 else 1900
            elif fmt == "D_MON_Y":
                d = int(m.group(1))
                month_str = m.group(2).lower().rstrip(".")
                mo = _MONTH_NAMES.get(month_str)
                if mo is None:
                    continue
                y = int(m.group(3))
            elif fmt == "MON_D_Y":
                month_str = m.group(1).lower().rstrip(".")
                mo = _MONTH_NAMES.get(month_str)
                if mo is None:
                    continue
                d = int(m.group(2))
                y = int(m.group(3))
            else:
                continue

            return date(y, mo, d)
        except (ValueError, OverflowError):
            continue

    # Fallback: try python-dateutil (if available)
    try:
        from dateutil import parser as du_parser
        # dayfirst=True for Indian convention (DD/MM/YYYY)
        dt = du_parser.parse(text, dayfirst=True)
        return dt.date()
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# C. BANK NAME NORMALIZER
# ---------------------------------------------------------------------------

# Canonical bank names → list of known aliases / abbreviations
_BANK_ALIASES: dict[str, list[str]] = {
    "State Bank of India": [
        "sbi", "state bank", "state bank of india", "s.b.i.", "s.b.i",
        "statebank", "sbin",
    ],
    "Punjab National Bank": [
        "pnb", "punjab national", "punjab national bank", "p.n.b.",
        "p.n.b",
    ],
    "Bank of Baroda": [
        "bob", "bank of baroda", "b.o.b.", "b.o.b", "baroda bank",
    ],
    "Canara Bank": [
        "canara", "canara bank", "canarabank",
    ],
    "Union Bank of India": [
        "union bank", "union bank of india", "ubi", "u.b.i.",
    ],
    "Bank of India": [
        "boi", "bank of india", "b.o.i.", "b.o.i",
    ],
    "Indian Overseas Bank": [
        "iob", "indian overseas", "indian overseas bank", "i.o.b.",
    ],
    "Central Bank of India": [
        "cbi", "central bank", "central bank of india",
    ],
    "Indian Bank": [
        "indian bank", "indianbank",
    ],
    "UCO Bank": [
        "uco", "uco bank", "ucobank",
    ],
    "Bank of Maharashtra": [
        "bom", "bank of maharashtra", "b.o.m.",
    ],
    "Punjab & Sind Bank": [
        "psb", "punjab and sind", "punjab sind", "punjab & sind bank",
        "p&sb",
    ],
    "IDBI Bank": [
        "idbi", "idbi bank",
    ],
    "HDFC Bank": [
        "hdfc", "hdfc bank", "h.d.f.c.",
    ],
    "ICICI Bank": [
        "icici", "icici bank", "i.c.i.c.i.",
    ],
    "Axis Bank": [
        "axis", "axis bank",
    ],
    "Kotak Mahindra Bank": [
        "kotak", "kotak mahindra", "kotak bank",
    ],
    "Yes Bank": [
        "yes bank", "yesbank",
    ],
    "IndusInd Bank": [
        "indusind", "indusind bank",
    ],
    "Federal Bank": [
        "federal", "federal bank",
    ],
    "South Indian Bank": [
        "sib", "south indian bank", "s.i.b.",
    ],
    "Karur Vysya Bank": [
        "kvb", "karur vysya", "karur vysya bank", "k.v.b.",
    ],
    "City Union Bank": [
        "cub", "city union", "city union bank",
    ],
    "Bandhan Bank": [
        "bandhan", "bandhan bank",
    ],
    "RBL Bank": [
        "rbl", "rbl bank", "ratnakar bank",
    ],
}

# Build reverse lookup: lowercased alias → canonical name
_ALIAS_LOOKUP: dict[str, str] = {}
for canonical, aliases in _BANK_ALIASES.items():
    _ALIAS_LOOKUP[canonical.lower()] = canonical
    for alias in aliases:
        _ALIAS_LOOKUP[alias.lower()] = canonical


def normalize_bank_name(raw: str) -> Optional[str]:
    """
    Normalize a bank name to its canonical form.

    Handles:
        "SBI"                          → "State Bank of India"
        "HDFC"                         → "HDFC Bank"
        "state bank of india"          → "State Bank of India"
        "P.N.B."                       → "Punjab National Bank"
        "Kotak"                        → "Kotak Mahindra Bank"
        "  sbi  "                      → "State Bank of India"

    Returns None if no match found (keeps original name as-is in caller).
    """
    if not raw or not raw.strip():
        return None

    text = raw.strip()
    key = text.lower()

    # Direct lookup
    if key in _ALIAS_LOOKUP:
        return _ALIAS_LOOKUP[key]

    # Try removing trailing "bank" / "ltd" / "limited" and re-lookup
    stripped = re.sub(r"\s+(bank|ltd\.?|limited)$", "", key).strip()
    if stripped in _ALIAS_LOOKUP:
        return _ALIAS_LOOKUP[stripped]

    # Try removing periods (S.B.I. → sbi)
    no_dots = key.replace(".", "").replace(" ", "")
    if no_dots in _ALIAS_LOOKUP:
        return _ALIAS_LOOKUP[no_dots]

    # No match — return None (caller keeps original)
    return None


# ---------------------------------------------------------------------------
# D. FDR NUMBER PARSER
# ---------------------------------------------------------------------------

# Common FDR number patterns seen in Indian bank documents
_FDR_NUMBER_PATTERNS: list[re.Pattern] = [
    # Standard: 01234567 to 0123456789012345 (8-16 digits)
    re.compile(r"\b(\d{8,16})\b"),
    # With prefix: FDR/0123456789012, FD-0123456789
    re.compile(r"\b(?:FDR?|FD|TDR?)[/\-\s]*(\d{8,16})\b", re.IGNORECASE),
    # With spaces: 0123 4567 8901 2345
    re.compile(r"\b(\d{4}\s\d{4}\s\d{4}(?:\s\d{2,4})?)\b"),
]


def parse_fdr_number(raw: str) -> Optional[str]:
    """
    Extract FDR/FD number from OCR text.

    Handles:
        "FDR No: 0123456789012"    → "0123456789012"
        "FD-0123456789"            → "0123456789"
        "0123 4567 8901 2345"      → "0123456789012345"
        "Account: 0123456789012"   → "0123456789012"

    Returns the cleaned (digits-only) FDR number, or None.
    """
    if not raw or not raw.strip():
        return None

    text = raw.strip()

    for pattern in _FDR_NUMBER_PATTERNS:
        m = pattern.search(text)
        if m:
            # Remove spaces from the matched group
            number = m.group(1).replace(" ", "")
            if len(number) >= 8:
                return number

    return None


# ---------------------------------------------------------------------------
# E. MATURITY PERIOD PARSER
# ---------------------------------------------------------------------------

_PERIOD_RE = re.compile(
    r"(\d+)\s*(year|yr|y|month|mon|m|day|d)s?",
    re.IGNORECASE,
)


def parse_tenure_days(raw: str) -> Optional[int]:
    """
    Parse tenure/maturity period string to approximate days.

    Handles:
        "1 Year"           → 365
        "1 year 6 months"  → 548
        "18 months"        → 548
        "365 days"         → 365
        "2Y 3M"            → 821

    Returns None if parsing fails.
    """
    if not raw or not raw.strip():
        return None

    matches = _PERIOD_RE.findall(raw)
    if not matches:
        return None

    total_days = 0
    for value_str, unit in matches:
        value = int(value_str)
        unit_lower = unit.lower()
        if unit_lower in ("year", "yr", "y"):
            total_days += value * 365
        elif unit_lower in ("month", "mon", "m"):
            # Approximate: 1 month ≈ 30.44 days
            total_days += round(value * 30.44)
        elif unit_lower in ("day", "d"):
            total_days += value

    return total_days if total_days > 0 else None


# ---------------------------------------------------------------------------
# F. INTEREST RATE PARSER
# ---------------------------------------------------------------------------

_RATE_RE = re.compile(
    r"(\d{1,2}(?:\.\d{1,4})?)\s*(?:%|percent|per\s*cent|p\.?a\.?|per\s*annum)",
    re.IGNORECASE,
)


def parse_interest_rate(raw: str) -> Optional[Decimal]:
    """
    Parse interest rate from OCR text.

    Handles:
        "7.5% p.a."         → 7.5
        "7.50 percent"      → 7.50
        "Rate: 6.25%"       → 6.25
        "7.5 per annum"     → 7.5

    Returns the rate as a Decimal (e.g. 7.5, not 0.075), or None.
    """
    if not raw or not raw.strip():
        return None

    m = _RATE_RE.search(raw)
    if m:
        try:
            rate = Decimal(m.group(1))
            # Sanity: interest rates are typically 0-20%
            if Decimal("0") < rate <= Decimal("25"):
                return rate
        except InvalidOperation:
            pass

    return None
