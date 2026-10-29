"""Alembic environment configuration — uses app settings for the DB URL."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings

# Import Base and all models so metadata is populated
from app.db.base import Base
from app.db.models import (  # noqa: F401 — side-effect imports
    Alert,
    AuditLog,
    Document,
    FeedbackLabel,
    Institution,
    Instrument,
    ReleaseRequest,
    RenewalLink,
    User,
    VerificationRecord,
    TrustScoreWeight,
    TrustScoreSnapshot,
    PredictionSnapshot,
    AIModel,
    OcrRun,
    NLSearchLog,
)

# Alembic Config object
config = context.config

# Set up loggers from the .ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the sync URL from settings
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connect to the DB."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
