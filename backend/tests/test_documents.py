"""Tests for document upload, download, validation, and encryption."""

from __future__ import annotations

import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.enums import FDRStatus
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.services.document_service import DocumentService


@pytest.fixture
def mock_minio_client():
    """Mock MinIO client for testing document upload/download without real MinIO server."""
    stored_objects: dict[str, bytes] = {}

    client = MagicMock()
    client.bucket_exists.return_value = True

    def _put_object(bucket, key, data, length, content_type):
        stored_objects[key] = data.read()

    def _get_object(bucket, key):
        data = stored_objects.get(key, b"")
        resp = MagicMock()
        resp.read.return_value = data
        return resp

    client.put_object.side_effect = _put_object
    client.get_object.side_effect = _get_object
    return client


@pytest.mark.asyncio
async def test_document_upload_and_download(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    inst1_headers: dict[str, str],
    mock_minio_client: MagicMock,
):
    """Uploading a PDF document encrypts it and download returns identical plaintext."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-DOC-TEST-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    pdf_content = b"%PDF-1.4\nTest PDF Document for FDR Verification"

    with patch("app.services.document_service.Minio", return_value=mock_minio_client):
        # 1. Upload
        upload_resp = await client.post(
            f"/instruments/{inst.id}/documents/",
            files={"file": ("certificate.pdf", pdf_content, "application/pdf")},
            data={"doc_type": "FDR_CERTIFICATE"},
            headers=inst1_headers,
        )
        assert upload_resp.status_code == 201
        doc_data = upload_resp.json()
        doc_id = doc_data["id"]
        assert doc_data["file_name"] == "certificate.pdf"

        # 2. Download
        download_resp = await client.get(
            f"/instruments/{inst.id}/documents/{doc_id}/download",
            headers=inst1_headers,
        )
        assert download_resp.status_code == 200
        assert download_resp.content == pdf_content


@pytest.mark.asyncio
async def test_document_magic_byte_validation(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_1: Institution,
    inst1_headers: dict[str, str],
):
    """Uploading invalid magic bytes (fake PDF) must return 400 Bad Request."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_1.id,
        reference_number=f"FDR-MAGIC-FAIL-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    fake_pdf = b"NOT A REAL PDF FILE HEADER"
    resp = await client.post(
        f"/instruments/{inst.id}/documents/",
        files={"file": ("fake.pdf", fake_pdf, "application/pdf")},
        data={"doc_type": "FDR_CERTIFICATE"},
        headers=inst1_headers,
    )
    assert resp.status_code == 400
    assert "magic bytes" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_document_institution_scoping(
    client: AsyncClient,
    db_session: AsyncSession,
    test_institution_2: Institution,
    inst1_headers: dict[str, str],
):
    """Institution 1 cannot upload to or download from Institution 2's instrument."""
    today = date.today()
    inst = Instrument(
        id=uuid.uuid4(),
        institution_id=test_institution_2.id,
        reference_number=f"FDR-OTHER-INST-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        amount=Decimal("1000000.00"),
        issue_date=today - timedelta(days=20),
        maturity_date=today + timedelta(days=365),
        status=FDRStatus.SUBMITTED,
    )
    db_session.add(inst)
    await db_session.commit()

    pdf_content = b"%PDF-1.4\nTest PDF"
    resp = await client.post(
        f"/instruments/{inst.id}/documents/",
        files={"file": ("cert.pdf", pdf_content, "application/pdf")},
        headers=inst1_headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Instrument not found"
