"""AI configuration endpoint — exposes kill switches and data-source labels."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/ai", tags=["AI Configuration"])


@router.get("/config")
async def get_ai_config() -> dict:
    """Return AI feature flags and data-source labels.

    This endpoint is public (no auth required) so the frontend can
    check which AI features are available before rendering UI elements.
    """
    settings = get_settings()
    return {
        "ai_enabled": settings.AI_ENABLED,
        "features": {
            "ocr": {
                "enabled": settings.AI_ENABLED and settings.AI_OCR_ENABLED,
                "data_source": "synthetic",
            },
            "trust_score": {
                "enabled": settings.AI_ENABLED and settings.AI_TRUST_ENABLED,
                "data_source": "rule_based",
            },
            "prediction": {
                "enabled": settings.AI_ENABLED and settings.AI_PREDICTION_ENABLED,
                "data_source": "synthetic",
            },
            "nl_search": {
                "enabled": settings.AI_ENABLED and settings.AI_NLSEARCH_ENABLED,
                "data_source": "n/a",
            },
            "feedback": {
                "enabled": settings.AI_ENABLED and settings.AI_FEEDBACK_ENABLED,
                "data_source": "n/a",
            },
        },
    }
