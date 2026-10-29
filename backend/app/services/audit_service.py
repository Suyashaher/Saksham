"""Tamper-evident audit log service with hash chain and advisory locking."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import compute_audit_hash, redact_payload
from app.db.models.audit import AuditLog

# Advisory lock key — constant for the audit chain
_AUDIT_LOCK_KEY = 8675309


class AuditService:
    """Append audit entries with a SHA-256 hash chain."""

    @staticmethod
    async def record(
        session: AsyncSession,
        *,
        actor_id: uuid.UUID | None,
        action: str,
        entity_type: str,
        entity_id: uuid.UUID,
        payload: dict | None = None,
    ) -> AuditLog:
        """Write an audit entry inside the caller's transaction.

        The advisory lock serialises concurrent writers so the hash chain
        stays linear. The caller is responsible for committing the session.
        """
        settings = get_settings()

        # Redact any sensitive keys before persisting
        safe_payload = redact_payload(payload)

        # Acquire advisory lock (released on commit / rollback)
        await session.execute(
            text("SELECT pg_advisory_xact_lock(:key)"),
            {"key": _AUDIT_LOCK_KEY},
        )

        # Get the hash of the latest entry
        result = await session.execute(
            select(AuditLog.hash)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(1)
        )
        prev_hash = result.scalar_one_or_none() or settings.AUDIT_GENESIS_HASH

        now = datetime.now(timezone.utc)
        new_hash = compute_audit_hash(
            prev_hash=prev_hash,
            user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=safe_payload,
            created_at=now,
        )

        entry = AuditLog(
            user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=safe_payload,
            created_at=now,
            prev_hash=prev_hash,
            hash=new_hash,
        )
        session.add(entry)
        return entry

    @staticmethod
    async def verify_chain(session: AsyncSession) -> dict:
        """Recompute the entire chain and check integrity.

        Returns {valid: bool, checked: int, total_checked: int, head_hash: str|None, first_broken_id: UUID|None}.
        """
        settings = get_settings()
        result = await session.execute(
            select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
        )
        entries = result.scalars().all()

        expected_prev = settings.AUDIT_GENESIS_HASH
        checked = 0
        last_hash = None

        for entry in entries:
            checked += 1

            # Verify prev_hash linkage
            if entry.prev_hash != expected_prev:
                return {
                    "valid": False,
                    "checked": checked,
                    "total_checked": checked,
                    "head_hash": last_hash,
                    "first_broken_id": entry.id,
                }

            # Recompute hash
            recomputed = compute_audit_hash(
                prev_hash=entry.prev_hash,
                user_id=entry.user_id,
                action=entry.action,
                entity_type=entry.entity_type,
                entity_id=entry.entity_id,
                payload=entry.payload,
                created_at=entry.created_at,
            )
            if entry.hash != recomputed:
                return {
                    "valid": False,
                    "checked": checked,
                    "total_checked": checked,
                    "head_hash": last_hash,
                    "first_broken_id": entry.id,
                }

            expected_prev = entry.hash
            last_hash = entry.hash

        return {
            "valid": True,
            "checked": checked,
            "total_checked": checked,
            "head_hash": last_hash,
            "first_broken_id": None,
        }

    @staticmethod
    async def list_logs(
        session: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 50,
        action: str | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[tuple[AuditLog, str | None, str | None]], int]:
        """Paginated, filtered list of audit entries with actor details."""
        from app.db.models.user import User

        query = (
            select(AuditLog, User.full_name, User.role)
            .outerjoin(User, AuditLog.user_id == User.id)
        )
        count_query = select(func.count()).select_from(AuditLog)

        if action:
            query = query.where(AuditLog.action.ilike(f"%{action}%"))
            count_query = count_query.where(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            query = query.where(AuditLog.entity_type == entity_type)
            count_query = count_query.where(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.where(AuditLog.entity_id == entity_id)
            count_query = count_query.where(AuditLog.entity_id == entity_id)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
            count_query = count_query.where(AuditLog.user_id == user_id)
        if date_from:
            query = query.where(AuditLog.created_at >= date_from)
            count_query = count_query.where(AuditLog.created_at >= date_from)
        if date_to:
            query = query.where(AuditLog.created_at <= date_to)
            count_query = count_query.where(AuditLog.created_at <= date_to)

        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(query)
        items = list(result.all())

        return items, total
