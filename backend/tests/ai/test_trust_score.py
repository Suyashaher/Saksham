"""Trust Score arithmetic tests — worked examples from design doc B.5."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai.trust.calculator import score_to_band, TrustScoreCalculator
from app.ai.trust.factors import FactorResult
from app.db.enums import TrustBand


class TestScoreBands:
    """Test score-to-band mapping per design doc B.4."""

    def test_high_band_100(self):
        assert score_to_band(100) == TrustBand.HIGH

    def test_high_band_80(self):
        assert score_to_band(80) == TrustBand.HIGH

    def test_medium_band_79(self):
        assert score_to_band(79) == TrustBand.MEDIUM

    def test_medium_band_50(self):
        assert score_to_band(50) == TrustBand.MEDIUM

    def test_low_band_49(self):
        assert score_to_band(49) == TrustBand.LOW

    def test_low_band_0(self):
        assert score_to_band(0) == TrustBand.LOW

    def test_low_band_negative_clamped(self):
        """Negative scores should map to LOW."""
        assert score_to_band(-5) == TrustBand.LOW


class TestWorkedExamples:
    """Test worked examples from design doc section B.5."""

    def test_example_1_perfect_instrument(self):
        """Example 1: All factors perfect → score ~95, HIGH band."""
        factors = [
            FactorResult("document_completeness", "all present", 1.0, "All docs", 20, 20),
            FactorResult("ocr_match", "all match", 1.0, "All match", 15, 15),
            FactorResult("bank_verification", "BANK_VERIFIED", 1.0, "Verified", 20, 20),
            FactorResult("amount_reasonableness", "within norms", 1.0, "Normal", 10, 10),
            FactorResult("date_consistency", "perfect", 1.0, "OK", 10, 10),
            FactorResult("alert_count", 0, 1.0, "No alerts", 10, 10),
            FactorResult("cross_doc_consistency", "match", 1.0, "Match", 5, 5),
            FactorResult("renewal_chain_integrity", "n/a", 1.0, "N/A", 5, 5),
            FactorResult("response_timeliness", "<3d", 1.0, "Fast", 3, 3),
            FactorResult("bank_reputation", "scheduled", 1.0, "SBI", 2, 2),
        ]
        total = sum(f.contribution for f in factors)
        assert total == 100
        assert score_to_band(round(total)) == TrustBand.HIGH

    def test_example_2_problematic_instrument(self):
        """Example 2: Multiple issues → score ~26, LOW band."""
        factors = [
            FactorResult("document_completeness", "missing", 0.5, "Missing", 20, 10),
            FactorResult("ocr_match", "mismatch", 0.0, "Mismatch", 15, 0),
            FactorResult("bank_verification", "SELF_DECLARED", 0.0, "Unverified", 20, 0),
            FactorResult("amount_reasonableness", "5x avg", 0.0, "Outlier", 10, 0),
            FactorResult("date_consistency", "ok", 1.0, "OK", 10, 10),
            FactorResult("alert_count", 2, 0.0, "2 alerts", 10, 0),
            FactorResult("cross_doc_consistency", "n/a", 0.5, "N/A", 5, 2.5),
            FactorResult("renewal_chain_integrity", "broken", 0.5, "Broken", 5, 2.5),
            FactorResult("response_timeliness", ">7d", 0.0, "Slow", 3, 0),
            FactorResult("bank_reputation", "coop", 0.5, "Coop", 2, 1),
        ]
        total = sum(f.contribution for f in factors)
        assert total == 26
        assert score_to_band(round(total)) == TrustBand.LOW

    def test_example_3_mid_range(self):
        """Example 3: Some issues → score ~76, MEDIUM band."""
        factors = [
            FactorResult("document_completeness", "all", 1.0, "All", 20, 20),
            FactorResult("ocr_match", "minor", 0.5, "Minor", 15, 7.5),
            FactorResult("bank_verification", "QR", 0.5, "QR", 20, 10),
            FactorResult("amount_reasonableness", "normal", 1.0, "Normal", 10, 10),
            FactorResult("date_consistency", "ok", 1.0, "OK", 10, 10),
            FactorResult("alert_count", 1, 0.5, "1 alert", 10, 5),
            FactorResult("cross_doc_consistency", "match", 1.0, "Match", 5, 5),
            FactorResult("renewal_chain_integrity", "n/a", 1.0, "N/A", 5, 5),
            FactorResult("response_timeliness", "5d", 0.5, "5 days", 3, 1.5),
            FactorResult("bank_reputation", "scheduled", 1.0, "Scheduled", 2, 2),
        ]
        total = sum(f.contribution for f in factors)
        assert total == 76
        assert score_to_band(round(total)) == TrustBand.MEDIUM
