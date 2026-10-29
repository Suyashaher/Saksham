# Spike: Field Parsers for Indian-Format OCR Output

> **Status**: COMPLETE — 126/126 tests passing
> **Data**: All test data is synthetic (hand-crafted edge cases)

## Purpose

Validate that we can reliably parse the messy text output of OCR engines into
structured fields for Indian bank FDR documents. These parsers will sit between
the OCR engine and the autofill/cross-check logic in the production pipeline.

## Parsers Implemented

| Parser | Function | Input Examples | Output |
|---|---|---|---|
| **Amount** | `parse_amount()` | `₹1,25,000.00`, `Rs. 1.5 Lakh`, `Five Hundred Thousand`, `12,50,000/-` | `Decimal` |
| **Date** | `parse_date()` | `05/03/2026`, `5-Mar-2026`, `5th March 2026`, `2026-03-05` | `date` |
| **Bank Name** | `normalize_bank_name()` | `SBI`, `S.B.I.`, `State Bank`, `HDFC` | Canonical `str` |
| **FDR Number** | `parse_fdr_number()` | `FDR No: 0123456789012`, `FD-012345678` | Digits-only `str` |
| **Tenure** | `parse_tenure_days()` | `1 Year 6 Months`, `18 months`, `365 days` | `int` (days) |
| **Interest Rate** | `parse_interest_rate()` | `7.5% p.a.`, `6.25 percent`, `8.00% PA` | `Decimal` |

## Results

| Parser | Test Cases | Passed | Failed | Pass Rate |
|---|---|---|---|---|
| Amount | 44 | 44 | 0 | **100%** |
| Date | 22 | 22 | 0 | **100%** |
| Bank Name | 28 | 28 | 0 | **100%** |
| FDR Number | 12 | 12 | 0 | **100%** |
| Tenure | 10 | 10 | 0 | **100%** |
| Interest Rate | 10 | 10 | 0 | **100%** |
| **TOTAL** | **126** | **126** | **0** | **100%** |

## Key Design Decisions

1. **Numeric path tried before words path** — prevents "1.5 lakh" being
   misinterpreted as word-form ("lakh" is both a multiplier and a word).

2. **Indian date convention** — `DD/MM/YYYY` assumed (not US `MM/DD/YYYY`).
   ISO format also supported.

3. **Graceful failure** — all parsers return `None` on un-parseable input.
   Caller can fall back to manual entry.

4. **26 Indian banks** covered in normalizer with abbreviations, dot-separated
   forms, and common aliases.

5. **No external dependencies** — only `python-dateutil` as optional fallback
   for exotic date formats. Core parsers use stdlib only.

## Document-Type Applicability

| Field | FDR_SCAN | DEPOSIT_CONFIRMATION | OTHER | CLOSURE |
|---|---|---|---|---|
| Amount | ✅ Primary | ✅ Cross-check | ⚠️ Maybe | ❌ System-generated |
| Date (issue/maturity) | ✅ Primary | ✅ Cross-check | ⚠️ Maybe | ❌ |
| Bank Name | ✅ Primary | ✅ Cross-check | ⚠️ Maybe | ❌ |
| FDR Number | ✅ Primary | ✅ Cross-check | ⚠️ Maybe | ❌ |
| Tenure | ✅ Primary | ❌ | ❌ | ❌ |
| Interest Rate | ✅ Primary | ❌ | ❌ | ❌ |

## Running

```bash
cd spikes/field_parsers
pip install -r requirements.txt   # optional: python-dateutil
python test_parsers.py
```

## Files

- `parsers.py` — All six parser functions
- `test_parsers.py` — 126 test cases with automated runner
- `requirements.txt` — Pinned dependencies
