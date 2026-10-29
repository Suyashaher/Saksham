"""Metadata API router — exposes system configuration, registries, and capabilities."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.core.document_registry import DocumentRegistry
from app.core.dependencies import get_current_user
from app.db.models.user import User

router = APIRouter(prefix="/meta", tags=["metadata"])


@router.get("/document-types")
async def get_document_types() -> dict[str, Any]:
    """Retrieve the central document and instrument type registry.

    Returns available instrument types, required/optional document types,
    allowed uploader roles, accepted MIME formats, and OCR capabilities.
    """
    return DocumentRegistry.get_api_metadata()
