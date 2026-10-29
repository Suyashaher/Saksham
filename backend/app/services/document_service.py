"""Document upload/download orchestration with encryption and MinIO storage."""

from __future__ import annotations

import hashlib
import io
import uuid
from pathlib import Path

try:
    from minio import Minio
except ImportError:
    Minio = None  # Handled at runtime if MinIO client is initialized

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.document import Document
from app.services.audit_service import AuditService
from app.services.encryption_service import EncryptionService

ALLOWED_MAGIC: dict[str, bytes] = {
    "application/pdf": b"%PDF",
    "image/jpeg": bytes([0xFF, 0xD8, 0xFF]),
    "image/png": bytes([0x89, 0x50, 0x4E, 0x47]),
}


class DocumentService:
    """Orchestrates document upload/download with encryption and MinIO storage (with local fallback)."""

    def __init__(self, settings: Settings) -> None:
        if Minio is not None:
            try:
                self._client = Minio(
                    endpoint=settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=False,
                )
            except Exception:
                self._client = None
        else:
            self._client = None

        self._encryption = EncryptionService(settings.DOCUMENT_ENCRYPTION_KEY)
        self._bucket = settings.MINIO_BUCKET
        self._max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        backend_dir = Path(__file__).resolve().parent.parent.parent
        self._local_storage_dir = backend_dir / "storage" / "documents"
        self._local_storage_dir.mkdir(parents=True, exist_ok=True)

    async def ensure_bucket(self) -> None:
        """Create the storage bucket if it does not already exist."""
        if self._client is not None:
            try:
                if not self._client.bucket_exists(self._bucket):
                    self._client.make_bucket(self._bucket)
            except Exception:
                pass

    def validate_file(
        self, file_bytes: bytes, content_type: str, filename: str
    ) -> None:
        """Validate file content: non-empty, magic bytes, and size limit.

        Raises ValueError with a descriptive message on failure.
        """
        if not file_bytes:
            raise ValueError("File is empty")

        if len(file_bytes) > self._max_size:
            raise ValueError(
                f"File exceeds maximum upload size of {self._max_size // (1024 * 1024)} MB"
            )

        expected_magic = ALLOWED_MAGIC.get(content_type)
        if expected_magic is None:
            raise ValueError(f"Content type '{content_type}' is not allowed")

        if not file_bytes[: len(expected_magic)] == expected_magic:
            raise ValueError(
                f"File content does not match expected magic bytes for '{content_type}'"
            )

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Strip path separators, null bytes, and limit length."""
        sanitized = filename.replace("/", "").replace("\\", "").replace("\x00", "")
        return sanitized[:200] if sanitized else "unnamed"

    async def upload(
        self,
        session: AsyncSession,
        instrument_id: uuid.UUID,
        file_bytes: bytes,
        content_type: str,
        filename: str,
        doc_type: str,
        uploaded_by: uuid.UUID,
    ) -> Document:
        """Encrypt and upload a document to MinIO or local storage, persisting metadata to the DB.

        The caller is responsible for committing the session.
        """
        self.validate_file(file_bytes, content_type, filename)

        sha256 = hashlib.sha256(file_bytes).hexdigest()
        encrypted = self._encryption.encrypt(file_bytes)
        sanitized_filename = self.sanitize_filename(filename)
        storage_key = f"{instrument_id}/{uuid.uuid4()}_{sanitized_filename}"

        saved_to_minio = False
        if self._client is not None:
            try:
                data_stream = io.BytesIO(encrypted)
                self._client.put_object(
                    self._bucket,
                    storage_key,
                    data_stream,
                    length=len(encrypted),
                    content_type="application/octet-stream",
                )
                saved_to_minio = True
            except Exception:
                saved_to_minio = False

        if not saved_to_minio:
            local_target = self._local_storage_dir / storage_key
            local_target.parent.mkdir(parents=True, exist_ok=True)
            local_target.write_bytes(encrypted)

        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            instrument_id=instrument_id,
            doc_type=doc_type,
            storage_key=storage_key,
            file_name=sanitized_filename,
            sha256=sha256,
            uploaded_by=uploaded_by,
        )
        session.add(doc)
        await session.flush()

        await AuditService.record(
            session,
            actor_id=uploaded_by,
            action="document_upload",
            entity_type="document",
            entity_id=doc_id,
            payload={
                "instrument_id": str(instrument_id),
                "file_name": sanitized_filename,
                "doc_type": doc_type,
                "sha256": sha256,
            },
        )

        return doc

    async def download(
        self, session: AsyncSession, document: Document
    ) -> tuple[bytes, str]:
        """Download and decrypt a document from MinIO or local storage.

        Returns (plaintext_bytes, original_filename).
        """
        encrypted: bytes | None = None
        if self._client is not None:
            try:
                response = self._client.get_object(self._bucket, document.storage_key)
                try:
                    encrypted = response.read()
                finally:
                    response.close()
                    response.release_conn()
            except Exception:
                encrypted = None

        if encrypted is None:
            backend_dir = Path(__file__).resolve().parent.parent.parent
            candidates = [
                self._local_storage_dir / document.storage_key,
                backend_dir / "storage" / "documents" / document.storage_key,
                Path("storage/documents") / document.storage_key,
                backend_dir.parent / "storage" / "documents" / document.storage_key,
            ]
            for candidate in candidates:
                if candidate.exists():
                    encrypted = candidate.read_bytes()
                    break

            if encrypted is None:
                raise ValueError(f"Document file not found in storage: {document.storage_key}")

        plaintext = self._encryption.decrypt(encrypted)
        return plaintext, document.file_name
