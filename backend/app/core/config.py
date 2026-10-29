"""Application settings loaded from environment variables via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache

import json
from pathlib import Path
from typing import Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Central configuration — every value can be overridden via env vars or .env."""

    model_config = SettingsConfigDict(
        env_file=(
            str(_BACKEND_DIR / ".env"),
            str(_BACKEND_DIR.parent / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://fdr_user:fdr_pass@postgres:5432/fdr_portal"
    DATABASE_URL_SYNC: str = (
        "postgresql+psycopg2://fdr_user:fdr_pass@postgres:5432/fdr_portal"
    )

    # ── Redis ───────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── MinIO ───────────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"

    # ── App ─────────────────────────────────────────────────────────────────────
    APP_NAME: str = "Saksham - AICTE Security Deposit & FDR Management Portal"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── JWT / Auth ──────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── OTP ─────────────────────────────────────────────────────────────────────
    OTP_EXPIRE_SECONDS: int = 300
    OTP_MAX_ATTEMPTS: int = 5
    REQUIRE_OTP: bool = True
    DEV_EXPOSE_OTP: bool = False

    # ── Rate Limiting ───────────────────────────────────────────────────────────
    RATE_LIMIT_AUTH: str = "5/minute"

    # ── Audit ───────────────────────────────────────────────────────────────────
    AUDIT_GENESIS_HASH: str = "GENESIS-FDR-PORTAL-v1"

    # ── Document Encryption ─────────────────────────────────────────────────────
    DOCUMENT_ENCRYPTION_KEY: str = ""  # Base64-encoded 32-byte AES-256 key

    # ── MinIO / Documents ───────────────────────────────────────────────────────
    MINIO_BUCKET: str = "fdr-documents"
    MAX_UPLOAD_SIZE_MB: int = 10

    # ── Bank Verification ───────────────────────────────────────────────────────
    BANK_VERIFIER: str = "mock"

    # ── Phase 4 — Clock / Demo ──────────────────────────────────────────────────
    # When DEMO_MODE=true, CLOCK_OVERRIDE_DATE (YYYY-MM-DD) shifts "today"
    CLOCK_OVERRIDE_DATE: str | None = None
    DEMO_MODE: bool = False

    # ── Phase 4 — Celery ────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"
    DAILY_SCAN_HOUR: int = 2    # 02:00 IST
    DAILY_SCAN_MINUTE: int = 0

    # ── Phase 4 — Email (MailHog in dev) ────────────────────────────────────────
    SMTP_HOST: str = "mailhog"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "fdr-portal@aicte.gov.in"
    SMTP_TLS: bool = False

    # ── Phase 4 — SMS ───────────────────────────────────────────────────────────
    SMS_PROVIDER: str = "console"   # "console" | "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # ── Phase 4 — System user ───────────────────────────────────────────────────
    SYSTEM_USER_ID: str = "00000000-0000-0000-0000-000000000002"

    # ── Phase 4 — Alert delivery ────────────────────────────────────────────────
    ALERT_MAX_ATTEMPTS: int = 5
    ALERT_RETRY_BASE_SECONDS: int = 60    # exponential backoff base

    # ── Phase 4 — Portal public URL (used in email templates) ───────────────────
    PORTAL_URL: str = "http://localhost:8000"

    # ── Phase 5 — Releases, Dashboard & Reports ─────────────────────────────────
    REQUIRED_DOC_TYPES: list[str] = ["FDR_SCAN", "DEPOSIT_CONFIRMATION"]
    DASHBOARD_CACHE_TTL: int = 60
    REPORT_MAX_ROWS: int = 50000

    # ── Phase 6 — Frontend CORS ─────────────────────────────────────────────────
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "https://saksham-a1mlox9o9-suyashaher99-3716s-projects.vercel.app",
        "https://saksham.vercel.app",
    ]
    CORS_ORIGIN_REGEX: str | None = r"https:\/\/.*\.vercel\.app"

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v_stripped.split(",") if origin.strip()]
        return list(v)

    # ── Phase 7B — AI / ML ──────────────────────────────────────────────────────
    AI_ENABLED: bool = True
    AI_OCR_ENABLED: bool = True
    AI_TRUST_ENABLED: bool = True
    AI_PREDICTION_ENABLED: bool = True
    AI_NLSEARCH_ENABLED: bool = True
    AI_FEEDBACK_ENABLED: bool = True

    # Gemini LLM
    GEMINI_API_KEY: str = ""

    # Tesseract OCR
    TESSERACT_CMD: str = "tesseract"  # path to tesseract binary
    OCR_SYNC_MAX_SIZE_MB: int = 5
    OCR_TIMEOUT_SECONDS: int = 60
    OCR_LANGUAGES: str = "eng+hin"

    # MLflow
    MLFLOW_TRACKING_URI: str = "sqlite:///mlflow.db"

    # Trust Score
    TRUST_SCORE_RECOMPUTE_HOUR: int = 3  # 03:00 IST nightly sweep

    # Prediction
    PREDICTION_RETRAIN_DAY: int = 6  # Sunday (0=Mon)
    PREDICTION_RETRAIN_HOUR: int = 4  # 04:00 IST
    PREDICTION_MIN_SAMPLES: int = 100
    PREDICTION_IMPROVEMENT_THRESHOLD: float = 0.05  # 5% MAE improvement

    # Feedback
    FEEDBACK_MAX_PER_DAY: int = 50
    FEEDBACK_CONSENSUS_THRESHOLD: int = 3
    FEEDBACK_WEIGHT_COOLDOWN_DAYS: int = 14

    # Model storage (file-based fallback when MLflow is unavailable)
    MODEL_STORAGE_DIR: str = "models"


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton of application settings."""
    return Settings()
