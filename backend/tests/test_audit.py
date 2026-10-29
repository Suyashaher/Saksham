"""Tests for Hash-Chained Tamper-Evident Audit Log."""

import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import compute_audit_hash, redact_payload
from app.db.models.audit import AuditLog
from app.db.models.user import User
from app.services.audit_service import AuditService


def test_redact_payload_strips_sensitive_keys():
    raw = {
        "email": "user@aicte.gov.in",
        "password": "SecretPassword123!",
        "otp": "654321",
        "nested": {
            "token": "eyJhbGciOi...",
            "secret": "supersecret",
            "public_id": 42,
        },
    }
    redacted = redact_payload(raw)
    assert redacted["email"] == "user@aicte.gov.in"
    assert redacted["password"] == "[REDACTED]"
    assert redacted["otp"] == "[REDACTED]"
    assert redacted["nested"]["token"] == "[REDACTED]"
    assert redacted["nested"]["secret"] == "[REDACTED]"
    assert redacted["nested"]["public_id"] == 42


@pytest.mark.asyncio
async def test_audit_chain_sequential_integrity(
    db_session: AsyncSession, admin_user: User
):
    # Record multiple entries
    for i in range(5):
        await AuditService.record(
            db_session,
            actor_id=admin_user.id,
            action=f"action_{i}",
            entity_type="test_entity",
            entity_id=uuid.uuid4(),
            payload={"step": i},
        )
    await db_session.commit()

    # Verify the entire chain
    result = await AuditService.verify_chain(db_session)
    assert result["valid"] is True
    assert result["checked"] >= 5
    assert result["first_broken_id"] is None


@pytest.mark.asyncio
async def test_audit_chain_detects_tampering(
    db_session: AsyncSession, admin_user: User
):
    entry1 = await AuditService.record(
        db_session,
        actor_id=admin_user.id,
        action="legitimate_action_1",
        entity_type="test_entity",
        entity_id=uuid.uuid4(),
        payload={"amount": 1000},
    )
    entry2 = await AuditService.record(
        db_session,
        actor_id=admin_user.id,
        action="legitimate_action_2",
        entity_type="test_entity",
        entity_id=uuid.uuid4(),
        payload={"amount": 2000},
    )
    await db_session.commit()

    # Tamper with entry 1: change its payload or action directly in DB bypassing trigger (or temporarily disabling trigger)
    # Using raw SQL to modify the hash directly
    await db_session.execute(
        text("ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_no_update;")
    )
    await db_session.execute(
        text("UPDATE audit_logs SET action = 'tampered_action' WHERE id = :id"),
        {"id": entry1.id},
    )
    await db_session.execute(
        text("ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_no_update;")
    )
    await db_session.commit()

    # Now verify chain should detect the tampering!
    check = await AuditService.verify_chain(db_session)
    assert check["valid"] is False
    assert check["first_broken_id"] == entry1.id


@pytest.mark.asyncio
async def test_audit_log_append_only_trigger_blocks_update(
    db_session: AsyncSession, admin_user: User
):
    entry = await AuditService.record(
        db_session,
        actor_id=admin_user.id,
        action="safe_action",
        entity_type="test_entity",
        entity_id=uuid.uuid4(),
        payload={"info": "immutable"},
    )
    await db_session.commit()

    # Attempt to UPDATE must be rejected by PostgreSQL trigger
    with pytest.raises(DBAPIError) as exc_info:
        await db_session.execute(
            text("UPDATE audit_logs SET action = 'illegal_update' WHERE id = :id"),
            {"id": entry.id},
        )
    await db_session.rollback()
    assert "append-only" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_audit_log_append_only_trigger_blocks_delete(
    db_session: AsyncSession, admin_user: User
):
    entry = await AuditService.record(
        db_session,
        actor_id=admin_user.id,
        action="safe_action",
        entity_type="test_entity",
        entity_id=uuid.uuid4(),
        payload={"info": "immutable"},
    )
    await db_session.commit()

    # Attempt to DELETE must be rejected by PostgreSQL trigger
    with pytest.raises(DBAPIError) as exc_info:
        await db_session.execute(
            text("DELETE FROM audit_logs WHERE id = :id"),
            {"id": entry.id},
        )
    await db_session.rollback()
    assert "append-only" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_audit_endpoint_verify_chain(
    client: AsyncClient, admin_headers: dict
):
    res = await client.get("/audit/verify-chain", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert "checked" in data
