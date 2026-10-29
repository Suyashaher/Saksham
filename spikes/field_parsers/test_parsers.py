"""
Test suite for Indian-format field parsers.

Covers: amounts (40+ cases), dates (20+ cases), bank names (25+ cases),
        FDR numbers (10+ cases), tenure (8+ cases), interest rates (8+ cases).

Run:  python -m pytest test_parsers.py -v
  or: python test_parsers.py
"""

from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal

from parsers import (
    normalize_bank_name,
    parse_amount,
    parse_date,
    parse_fdr_number,
    parse_interest_rate,
    parse_tenure_days,
)

# ───────────────────────────────────────────────────────────────────
# A. AMOUNT PARSER TESTS — 45 cases
# ───────────────────────────────────────────────────────────────────

AMOUNT_CASES: list[tuple[str, Decimal | None]] = [
    # --- Indian comma grouping ---
    ("₹1,25,000.00",         Decimal("125000.00")),
    ("Rs. 5,00,000",         Decimal("500000")),
    ("Rs 10,00,000.50",      Decimal("1000000.50")),
    ("INR 1,25,000",         Decimal("125000")),
    ("₹ 12,50,000/-",        Decimal("1250000")),
    ("Rs.50,000",            Decimal("50000")),
    ("1,25,000.00",          Decimal("125000.00")),
    ("1,00,00,000",          Decimal("10000000")),

    # --- Plain numbers ---
    ("125000",               Decimal("125000")),
    ("125000.50",            Decimal("125000.50")),
    ("5000000",              Decimal("5000000")),

    # --- Multiplier words ---
    ("INR 1.5 Lakh",         Decimal("150000")),
    ("Rs. 1.5 lakh",         Decimal("150000")),
    ("5 crore",              Decimal("50000000")),
    ("₹ 2.5 crore",         Decimal("25000000")),
    ("Rs 25 lacs",           Decimal("2500000")),
    ("1 lakh",               Decimal("100000")),
    ("10 lakhs",             Decimal("1000000")),
    ("₹5 Lakh",              Decimal("500000")),
    ("3.75 crores",          Decimal("37500000")),

    # --- English words ---
    ("Rupees One Lakh Twenty Five Thousand Only",     Decimal("125000")),
    ("One Lakh Only",                                 Decimal("100000")),
    ("Five Hundred Thousand",                         Decimal("500000")),
    ("Rupees Fifty Thousand Only",                    Decimal("50000")),
    ("Twenty Five Lakh",                              Decimal("2500000")),
    ("One Crore",                                     Decimal("10000000")),
    ("Two Lakh Fifty Thousand",                       Decimal("250000")),
    ("Rupees Ten Thousand Only",                      Decimal("10000")),

    # --- Currency prefix variations ---
    ("Indian Rupees 1,25,000",   Decimal("125000")),
    ("Rupee 50,000",             Decimal("50000")),
    ("₹ 1,25,000.00",           Decimal("125000.00")),
    ("Rs: 1,25,000",             Decimal("125000")),

    # --- Trailing slash-dash ---
    ("1,25,000/-",           Decimal("125000")),
    ("50000/-",              Decimal("50000")),
    ("Rs. 1,25,000/- Only",  Decimal("125000")),

    # --- International comma grouping (also works) ---
    ("125,000.00",           Decimal("125000.00")),
    ("1,250,000",            Decimal("1250000")),

    # --- Edge: whitespace ---
    ("  ₹  1,25,000  ",     Decimal("125000")),
    ("  ",                   None),
    ("",                     None),

    # --- OCR noise (should still parse or gracefully fail) ---
    ("Rs. O,00,000",         None),  # O not 0 — should fail
    ("₹???",                 None),

    # --- Large amounts ---
    ("Rs. 100,00,00,000",    Decimal("1000000000")),
    ("10 crore",             Decimal("100000000")),
]


# ───────────────────────────────────────────────────────────────────
# B. DATE PARSER TESTS — 22 cases
# ───────────────────────────────────────────────────────────────────

DATE_CASES: list[tuple[str, date | None]] = [
    # DD/MM/YYYY (Indian standard)
    ("05/03/2026",           date(2026, 3, 5)),
    ("5/3/2026",             date(2026, 3, 5)),
    ("31/12/2025",           date(2025, 12, 31)),

    # DD-MM-YYYY
    ("05-03-2026",           date(2026, 3, 5)),
    ("5-3-2026",             date(2026, 3, 5)),

    # DD.MM.YYYY
    ("05.03.2026",           date(2026, 3, 5)),

    # DD/MM/YY
    ("05/03/26",             date(2026, 3, 5)),
    ("05/03/99",             date(1999, 3, 5)),

    # DD Mon YYYY
    ("5 Mar 2026",           date(2026, 3, 5)),
    ("05-Mar-2026",          date(2026, 3, 5)),
    ("5th March 2026",       date(2026, 3, 5)),
    ("1st January 2025",     date(2025, 1, 1)),
    ("22nd Feb 2026",        date(2026, 2, 22)),
    ("3rd September 2025",   date(2025, 9, 3)),

    # Mon DD, YYYY
    ("March 5, 2026",        date(2026, 3, 5)),
    ("January 1, 2025",      date(2025, 1, 1)),
    ("December 31, 2025",    date(2025, 12, 31)),

    # ISO
    ("2026-03-05",           date(2026, 3, 5)),
    ("2025-12-31",           date(2025, 12, 31)),

    # Edge cases
    ("  05/03/2026  ",       date(2026, 3, 5)),
    ("",                     None),
    ("not a date",           None),
]


# ───────────────────────────────────────────────────────────────────
# C. BANK NAME NORMALIZER TESTS — 28 cases
# ───────────────────────────────────────────────────────────────────

BANK_CASES: list[tuple[str, str | None]] = [
    # Standard abbreviations
    ("SBI",                          "State Bank of India"),
    ("sbi",                          "State Bank of India"),
    ("S.B.I.",                       "State Bank of India"),
    ("State Bank of India",          "State Bank of India"),
    ("state bank",                   "State Bank of India"),

    ("PNB",                          "Punjab National Bank"),
    ("P.N.B.",                       "Punjab National Bank"),
    ("Punjab National Bank",         "Punjab National Bank"),

    ("HDFC",                         "HDFC Bank"),
    ("hdfc bank",                    "HDFC Bank"),
    ("H.D.F.C.",                     "HDFC Bank"),

    ("ICICI",                        "ICICI Bank"),
    ("icici bank",                   "ICICI Bank"),

    ("BOB",                          "Bank of Baroda"),
    ("Bank of Baroda",               "Bank of Baroda"),
    ("Baroda Bank",                  "Bank of Baroda"),

    ("Canara",                       "Canara Bank"),
    ("canara bank",                  "Canara Bank"),

    ("Axis",                         "Axis Bank"),
    ("axis bank",                    "Axis Bank"),

    ("Kotak",                        "Kotak Mahindra Bank"),
    ("kotak mahindra",               "Kotak Mahindra Bank"),

    ("IOB",                          "Indian Overseas Bank"),
    ("Indian Overseas Bank",         "Indian Overseas Bank"),

    ("KVB",                          "Karur Vysya Bank"),
    ("Bandhan",                      "Bandhan Bank"),

    # Whitespace
    ("  sbi  ",                      "State Bank of India"),

    # Unknown bank — returns None
    ("Random Bank of Nowhere",       None),
]


# ───────────────────────────────────────────────────────────────────
# D. FDR NUMBER PARSER TESTS — 12 cases
# ───────────────────────────────────────────────────────────────────

FDR_CASES: list[tuple[str, str | None]] = [
    ("FDR No: 0123456789012",        "0123456789012"),
    ("FD-0123456789",                "0123456789"),
    ("FDR/0123456789012",            "0123456789012"),
    ("TDR-01234567890",              "01234567890"),
    ("Account: 0123456789012",       "0123456789012"),
    ("0123 4567 8901 2345",          "0123456789012345"),
    ("0123456789012345",             "0123456789012345"),
    ("01234567",                     "01234567"),
    # Too short
    ("1234",                         None),
    ("",                             None),
    # Embedded in text
    ("Your FDR number is 9876543210 dated 01/01/2025", "9876543210"),
    ("Ref: FD-12345678901234",       "12345678901234"),
]


# ───────────────────────────────────────────────────────────────────
# E. TENURE PARSER TESTS — 10 cases
# ───────────────────────────────────────────────────────────────────

TENURE_CASES: list[tuple[str, int | None]] = [
    ("1 Year",               365),
    ("1 year 6 months",      548),
    ("18 months",            548),
    ("365 days",             365),
    ("2Y 3M",                821),
    ("2 years",              730),
    ("6 months",             183),
    ("90 days",              90),
    ("",                     None),
    ("not a tenure",         None),
]


# ───────────────────────────────────────────────────────────────────
# F. INTEREST RATE PARSER TESTS — 10 cases
# ───────────────────────────────────────────────────────────────────

RATE_CASES: list[tuple[str, Decimal | None]] = [
    ("7.5% p.a.",            Decimal("7.5")),
    ("7.50 percent",         Decimal("7.50")),
    ("Rate: 6.25%",          Decimal("6.25")),
    ("7.5 per annum",        Decimal("7.5")),
    ("Interest @ 8.00% PA",  Decimal("8.00")),
    ("5.5%",                 Decimal("5.5")),
    ("10 per cent",          Decimal("10")),
    # Edge: out of range
    ("50%",                  None),  # >25% → rejected
    ("",                     None),
    ("no rate here",         None),
]


# ═══════════════════════════════════════════════════════════════════
# TEST RUNNER
# ═══════════════════════════════════════════════════════════════════

def _safe_print(text: str):
    """Print text, replacing unencodable chars on Windows."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def _run_suite(name: str, cases, parser_fn, compare_fn=None):
    """Run a test suite, printing results and returning (passed, failed)."""
    passed = 0
    failed = 0
    failures = []

    for raw, expected in cases:
        result = parser_fn(raw)
        if compare_fn:
            ok = compare_fn(result, expected)
        else:
            ok = result == expected

        if ok:
            passed += 1
        else:
            failed += 1
            failures.append((raw, expected, result))

    status = "ALL PASSED" if failed == 0 else f"{failed} FAILED"
    _safe_print(f"\n{'='*60}")
    _safe_print(f"  {name}: {passed}/{passed+failed} passed  {status}")
    _safe_print(f"{'='*60}")

    if failures:
        for raw, expected, got in failures:
            _safe_print(f"  FAIL: parse({raw!r})")
            _safe_print(f"        expected: {expected!r}")
            _safe_print(f"        got:      {got!r}")

    return passed, failed


def main():
    total_passed = 0
    total_failed = 0

    suites = [
        ("Amount Parser", AMOUNT_CASES, parse_amount),
        ("Date Parser", DATE_CASES, parse_date),
        ("Bank Name Normalizer", BANK_CASES, normalize_bank_name),
        ("FDR Number Parser", FDR_CASES, parse_fdr_number),
        ("Tenure Parser", TENURE_CASES, parse_tenure_days),
        ("Interest Rate Parser", RATE_CASES, parse_interest_rate),
    ]

    for name, cases, fn in suites:
        p, f = _run_suite(name, cases, fn)
        total_passed += p
        total_failed += f

    _safe_print(f"\n{'#'*60}")
    _safe_print(f"  TOTAL: {total_passed}/{total_passed+total_failed} passed")
    if total_failed > 0:
        _safe_print(f"  {total_failed} FAILURES -- see above")
        sys.exit(1)
    else:
        _safe_print(f"  ALL {total_passed} TESTS PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
