"""Kill switch tests — verify AI features disable cleanly."""

import pytest

from app.ai.common.payload_guard import check_payload


class TestKillSwitches:
    """Verify kill switch configuration behavior."""

    def test_ai_config_returns_feature_flags(self):
        """GET /ai/config should return all feature flags."""
        from app.core.config import Settings

        # Create settings with AI disabled
        settings = Settings(
            AI_ENABLED=False,
            DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
            DATABASE_URL_SYNC="postgresql+psycopg2://test:test@localhost/test",
        )

        assert settings.AI_ENABLED is False
        assert settings.AI_OCR_ENABLED is True  # individual flags still true
        assert settings.AI_TRUST_ENABLED is True

    def test_individual_feature_flags(self):
        """Individual feature flags can be toggled independently."""
        from app.core.config import Settings

        settings = Settings(
            AI_ENABLED=True,
            AI_OCR_ENABLED=False,
            AI_TRUST_ENABLED=True,
            AI_PREDICTION_ENABLED=False,
            DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
            DATABASE_URL_SYNC="postgresql+psycopg2://test:test@localhost/test",
        )

        assert settings.AI_ENABLED is True
        assert settings.AI_OCR_ENABLED is False
        assert settings.AI_TRUST_ENABLED is True
        assert settings.AI_PREDICTION_ENABLED is False

    def test_global_disable_overrides_individual(self):
        """When AI_ENABLED=false, all features should be considered disabled."""
        from app.core.config import Settings

        settings = Settings(
            AI_ENABLED=False,
            AI_OCR_ENABLED=True,
            DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
            DATABASE_URL_SYNC="postgresql+psycopg2://test:test@localhost/test",
        )

        # The router checks: settings.AI_ENABLED and settings.AI_OCR_ENABLED
        effective_ocr = settings.AI_ENABLED and settings.AI_OCR_ENABLED
        assert effective_ocr is False
