"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    HAS_SLOWAPI = True
except ImportError:
    HAS_SLOWAPI = False

from app.api.admin import router as admin_router
from app.api.alert_rules import router as alert_rules_router
from app.api.alerts import router as alerts_router
from app.api.audit import router as audit_router
from app.api.auth import limiter, router as auth_router
from app.api.closure import router as closure_router
from app.api.dashboard import router as dashboard_router
from app.api.documents import router as documents_router
from app.api.health import router as health_router
from app.api.instruments import router as instruments_router
from app.api.meta import router as meta_router
from app.api.notifications import router as notifications_router
from app.api.release_requests import router as release_requests_router
from app.api.reports import router as reports_router
from app.api.ai_config import router as ai_config_router
from app.api.ai_ocr import router as ai_ocr_router
from app.api.ai_trust import router as ai_trust_router
from app.api.ai_prediction import router as ai_prediction_router
from app.api.ai_nlsearch import router as ai_nlsearch_router
from app.api.ai_feedback import router as ai_feedback_router
from app.api.ai_models import router as ai_models_router
from app.core.config import get_settings
from app.core.logging import setup_logging


def create_app() -> FastAPI:
    """Application factory."""
    settings = get_settings()
    setup_logging(debug=settings.DEBUG)

    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Attach rate limiter if available
    application.state.limiter = limiter
    if HAS_SLOWAPI:
        application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Attach CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    application.include_router(health_router)
    application.include_router(auth_router)
    application.include_router(admin_router)
    application.include_router(audit_router)
    application.include_router(instruments_router)
    application.include_router(documents_router)
    application.include_router(release_requests_router)
    application.include_router(closure_router)
    application.include_router(dashboard_router)
    application.include_router(reports_router)
    application.include_router(meta_router)
    application.include_router(alert_rules_router)
    application.include_router(alert_rules_router, prefix="/admin")
    application.include_router(alerts_router)
    application.include_router(notifications_router)

    # Phase 7B — AI routers
    application.include_router(ai_config_router)
    application.include_router(ai_ocr_router)
    application.include_router(ai_trust_router)
    application.include_router(ai_prediction_router)
    application.include_router(ai_nlsearch_router)
    application.include_router(ai_feedback_router)
    application.include_router(ai_models_router)

    return application


app = create_app()
