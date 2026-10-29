"""Health-check endpoint — verifies app + DB connectivity."""

from __future__ import annotations

import asyncio
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import async_session_factory

router = APIRouter(tags=["health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> JSONResponse:
    """Return application status and database connectivity."""
    settings = get_settings()
    db_status = "ok"
    http_status = status.HTTP_200_OK

    try:
        async def _ping_db():
            async with async_session_factory() as session:
                await session.execute(text("SELECT 1"))

        await asyncio.wait_for(_ping_db(), timeout=2.0)
    except Exception:
        db_status = "unreachable"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=http_status,
        content={
            "status": "ok" if db_status == "ok" else "degraded",
            "db": db_status,
            "version": settings.APP_VERSION,
        },
    )
