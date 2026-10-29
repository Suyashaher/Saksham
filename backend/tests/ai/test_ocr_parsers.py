"""OCR field parser tests — adapted from spike (126 test cases)."""

import pytest
from datetime import date
from decimal import Decimal

from app.ai.ocr.parsers import (
    parse_amount,
    parse_date,
    normalize_bank_name,
    parse_fdr_number,
    parse_tenure_days,
    parse_interest_rate,
)


class TestParseAmount:
    """Amount parser handles Indian notation, words, multipliers."""

    def test_plain_number(self):
        assert parse_amount("125000") == Decimal("125000")

    def test_indian_commas(self):
        assert parse_amount("1,25,000") == Decimal("125000")

    def test_indian_commas_decimal(self):
        assert parse_amount("1,25,000.50") == Decimal("125000.50")

    def test_rupee_symbol(self):
        result = parse_amount("\u20b91,25,000.00")
        assert result == Decimal("125000.00")

    def test_rs_prefix(self):
        assert parse_amount("Rs. 5,00,000") == Decimal("500000")

    def test_inr_prefix(self):
        assert parse_amount("INR 1.5 Lakh") == Decimal("150000")

    def test_lakh_multiplier(self):
        assert parse_amount("5 lakh") == Decimal("500000")

    def test_crore_multiplier(self):
        assert parse_amount("5 crore") == Decimal("50000000")

    def test_word_form(self):
        result = parse_amount("Rupees One Lakh Twenty Five Thousand Only")
        assert result == Decimal("125000")

    def test_trailing_slash(self):
        assert parse_amount("12,50,000/-") == Decimal("1250000")

    def test_empty_returns_none(self):
        assert parse_amount("") is None

    def test_none_returns_none(self):
        assert parse_amount("   ") is None

    def test_thousand_k(self):
        assert parse_amount("500k") == Decimal("500000")


class TestParseDate:
    """Date parser handles Indian and international formats."""

    def test_iso_format(self):
        assert parse_date("2026-03-05") == date(2026, 3, 5)

    def test_dd_mm_yyyy_slash(self):
        assert parse_date("05/03/2026") == date(2026, 3, 5)

    def test_dd_mm_yyyy_dash(self):
        assert parse_date("05-03-2026") == date(2026, 3, 5)

    def test_dd_mon_yyyy(self):
        assert parse_date("5-Mar-2026") == date(2026, 3, 5)

    def test_ordinal_date(self):
        assert parse_date("5th March 2026") == date(2026, 3, 5)

    def test_mon_dd_yyyy(self):
        assert parse_date("March 5, 2026") == date(2026, 3, 5)

    def test_dd_mm_yy_short(self):
        assert parse_date("05/03/26") == date(2026, 3, 5)

    def test_dot_separator(self):
        assert parse_date("05.03.2026") == date(2026, 3, 5)

    def test_empty_returns_none(self):
        assert parse_date("") is None


class TestNormalizeBankName:
    """Bank name normalizer handles abbreviations and aliases."""

    def test_sbi(self):
        assert normalize_bank_name("SBI") == "State Bank of India"

    def test_hdfc(self):
        assert normalize_bank_name("HDFC") == "HDFC Bank"

    def test_full_name(self):
        assert normalize_bank_name("State Bank of India") == "State Bank of India"

    def test_pnb_dots(self):
        assert normalize_bank_name("P.N.B.") == "Punjab National Bank"

    def test_kotak(self):
        assert normalize_bank_name("Kotak") == "Kotak Mahindra Bank"

    def test_whitespace_stripped(self):
        assert normalize_bank_name("  sbi  ") == "State Bank of India"

    def test_unknown_returns_none(self):
        assert normalize_bank_name("Random Unknown Bank") is None

    def test_empty_returns_none(self):
        assert normalize_bank_name("") is None


class TestParseFdrNumber:
    """FDR number parser extracts numeric identifiers."""

    def test_plain_digits(self):
        assert parse_fdr_number("FDR No: 0123456789012") == "0123456789012"

    def test_fd_dash(self):
        assert parse_fdr_number("FD-0123456789") == "0123456789"

    def test_spaced_number(self):
        result = parse_fdr_number("0123 4567 8901 2345")
        assert result == "0123456789012345"

    def test_empty(self):
        assert parse_fdr_number("") is None


class TestParseTenureDays:
    """Tenure parser handles years, months, days."""

    def test_one_year(self):
        assert parse_tenure_days("1 Year") == 365

    def test_18_months(self):
        assert parse_tenure_days("18 months") == 548

    def test_365_days(self):
        assert parse_tenure_days("365 days") == 365

    def test_mixed(self):
        assert parse_tenure_days("2Y 3M") == 821

    def test_empty(self):
        assert parse_tenure_days("") is None


class TestParseInterestRate:
    """Interest rate parser handles various rate notations."""

    def test_percent(self):
        assert parse_interest_rate("7.5% p.a.") == Decimal("7.5")

    def test_percent_word(self):
        assert parse_interest_rate("7.50 percent") == Decimal("7.50")

    def test_per_annum(self):
        assert parse_interest_rate("7.5 per annum") == Decimal("7.5")

    def test_with_label(self):
        assert parse_interest_rate("Rate: 6.25%") == Decimal("6.25")

    def test_empty(self):
        assert parse_interest_rate("") is None
