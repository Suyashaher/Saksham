"""Graceful degradation tests — verify fallbacks work correctly."""

import pytest
from unittest.mock import patch

from app.ai.ocr.engine import NullEngine, get_ocr_engine
from app.ai.ocr.extractor import TesseractOcrExtractor
from app.ai.common.llm_client import NullLlmClient, get_llm_client
from app.ai.prediction.predictor import ApprovalTimePredictor


class TestOcrDegradation:
    """Verify OCR degrades gracefully when Tesseract is unavailable."""

    def test_null_engine_returns_empty(self):
        """NullEngine should return empty string."""
        engine = NullEngine()
        assert engine.ocr_image(b"fake image") == ""
        assert engine.is_available() is False
        assert engine.engine_name == "null"

    def test_extractor_with_null_engine(self):
        """TesseractOcrExtractor with NullEngine should return empty fields."""
        engine = NullEngine()
        extractor = TesseractOcrExtractor(engine=engine)
        assert extractor.is_available is False

    @patch("app.ai.ocr.engine.TesseractEngine.is_available", return_value=False)
    def test_get_ocr_engine_falls_back(self, mock_avail):
        """get_ocr_engine should return NullEngine when Tesseract unavailable."""
        engine = get_ocr_engine()
        assert isinstance(engine, NullEngine)


class TestLlmDegradation:
    """Verify LLM degrades gracefully when API key is missing."""

    async def test_null_client_returns_none(self):
        """NullLlmClient.structured_output should return None."""
        from pydantic import BaseModel

        class TestSchema(BaseModel):
            test: str = ""

        client = NullLlmClient()
        result = await client.structured_output("test prompt", TestSchema)
        assert result is None
        assert client.provider_name == "none"

    @patch("app.core.config.get_settings")
    def test_get_llm_client_no_key(self, mock_settings):
        """get_llm_client should return NullLlmClient when no API key."""
        from unittest.mock import MagicMock

        settings_mock = MagicMock()
        settings_mock.GEMINI_API_KEY = ""
        mock_settings.return_value = settings_mock
        client = get_llm_client()
        assert isinstance(client, NullLlmClient)


class TestPredictionDegradation:
    """Verify prediction degrades to heuristic when no model available."""

    def test_heuristic_prediction(self):
        """Heuristic prediction should return reasonable defaults."""
        predictor = ApprovalTimePredictor()
        result = predictor._heuristic_prediction(
            "verification",
            {"doc_completeness": 1.0, "n_alerts": 0, "is_renewal": False, "officer_workload": 0},
        )
        assert result.is_heuristic is True
        assert result.predicted_days > 0
        assert result.model_version == "heuristic-v1"
        assert result.data_source == "n/a"
        assert len(result.reasons) > 0

    def test_heuristic_with_incomplete_docs(self):
        """Incomplete docs should increase heuristic estimate."""
        predictor = ApprovalTimePredictor()
        complete = predictor._heuristic_prediction(
            "verification",
            {"doc_completeness": 1.0, "n_alerts": 0, "is_renewal": False, "officer_workload": 0},
        )
        incomplete = predictor._heuristic_prediction(
            "verification",
            {"doc_completeness": 0.5, "n_alerts": 0, "is_renewal": False, "officer_workload": 0},
        )
        assert incomplete.predicted_days > complete.predicted_days
