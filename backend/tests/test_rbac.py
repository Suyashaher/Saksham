"""Tests for Role-Based Access Control and Row-Level Institution Scoping."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import scope_to_institution
from app.core.security import create_access_token
from app.db.enums import FDRStatus, VerificationTag
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.user import User

settings = get_settings()


# ── Role / Route Access Matrix ───────────────────────────

@pytest.mark.asyncio
async def test_admin_route_access_matrix(
    client: AsyncClient,
    admin_headers: dict,
    officer_headers: dict,
    approver_headers: dict,
    inst1_headers: dict,
):
    # ADMIN -> 200
    res_admin = await client.get("/admin/users", headers=admin_headers)
    assert res_admin.status_code == 200

    # VERIFYING_OFFICER -> 403
    res_officer = await client.get("/admin/users", headers=officer_headers)
    assert res_officer.status_code == 403

    # APPROVING_AUTHORITY -> 403
    res_approver = await client.get("/admin/users", headers=approver_headers)
    assert res_approver.status_code == 403

    # INSTITUTION -> 403
    res_inst = await client.get("/admin/users", headers=inst1_headers)
    assert res_inst.status_code == 403


@pytest.mark.asyncio
async def test_audit_logs_access_matrix(
    client: AsyncClient,
    admin_headers: dict,
    officer_headers: dict,
    approver_headers: dict,
    inst1_headers: dict,
):
    # ADMIN -> 200
    res_admin = await client.get("/audit/logs", headers=admin_headers)
    assert res_admin.status_code == 200

    # VERIFYING_OFFICER -> 200
    res_officer = await client.get("/audit/logs", headers=officer_headers)
    assert res_officer.status_code == 200

    # APPROVING_AUTHORITY -> 403
    res_approver = await client.get("/audit/logs", headers=approver_headers)
    assert res_approver.status_code == 403

    # INSTITUTION -> 403
    res_inst = await client.get("/audit/logs", headers=inst1_headers)
    assert res_inst.status_code == 403


@pytest.mark.asyncio
async def test_audit_verify_chain_access_matrix(
    client: AsyncClient,
    admin_headers: dict,
    officer_headers: dict,
    approver_headers: dict,
    inst1_headers: dict,
):
    # ADMIN -> 200
    res_admin = await client.get("/audit/verify-chain", headers=admin_headers)
    assert res_admin.status_code == 200

    # VERIFYING_OFFICER -> 403
    res_officer = await client.get("/audit/verify-chain", headers=officer_headers)
    assert res_officer.status_code == 403

    # APPROVING_AUTHORITY -> 403
    res_approver = await client.get("/audit/verify-chain", headers=approver_headers)
    assert res_approver.status_code == 403

    # INSTITUTION -> 403
    res_inst = await client.get("/audit/verify-chain", headers=inst1_headers)
    assert res_inst.status_code == 403


# ── Missing and Invalid Token Rejection ──────────────────

@pytest.mark.asyncio
async def test_missing_token_returns_401(client: AsyncClient):
    res = await client.get("/auth/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_corrupted_token_returns_401(client: AsyncClient):
    res = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_returns_401(client: AsyncClient, admin_user: User):
    expired_payload = {
        "sub": str(admin_user.id),
        "role": admin_user.role.value,
        "exp": datetime.now(timezone.utc) - timedelta(minutes=10),
        "iat": datetime.now(timezone.utc) - timedelta(minutes=25),
        "type": "access",
    }
    expired_jwt = jwt.encode(
        expired_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {expired_jwt}"})
    assert res.status_code == 401


# ── Row-Level Scoping Helper Unit Tests ──────────────────

@pytest.mark.asyncio
async def test_scope_to_institution_enforcement(
    db_session: AsyncSession,
    test_institution_1: Institution,
    test_institution_2: Institution,
    institution_user_1: User,
    institution_user_2: User,
    officer_user: User,
    admin_user: User,
):
    # Create an instrument for Institution 1
    inst1_instrument = Instrument(
        institution_id=test_institution_1.id,
        reference_number=f"FDR-SCOPE-1-{test_institution_1.id.hex[:4]}",
        issuing_bank="State Bank",
        amount=Decimal("100000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    # Create an instrument for Institution 2
    inst2_instrument = Instrument(
        institution_id=test_institution_2.id,
        reference_number=f"FDR-SCOPE-2-{test_institution_2.id.hex[:4]}",
        issuing_bank="State Bank",
        amount=Decimal("200000.00"),
        issue_date=date(2025, 1, 1),
        maturity_date=date(2026, 1, 1),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add_all([inst1_instrument, inst2_instrument])
    await db_session.commit()

    base_query = select(Instrument)

    # 1. Institution User 1 sees ONLY institution 1's instrument
    q1 = scope_to_institution(base_query, institution_user_1)
    res1 = (await db_session.execute(q1)).scalars().all()
    res1_ids = {r.id for r in res1}
    assert inst1_instrument.id in res1_ids
    assert inst2_instrument.id not in res1_ids

    # 2. Institution User 2 sees ONLY institution 2's instrument
    q2 = scope_to_institution(base_query, institution_user_2)
    res2 = (await db_session.execute(q2)).scalars().all()
    res2_ids = {r.id for r in res2}
    assert inst2_instrument.id in res2_ids
    assert inst1_instrument.id not in res2_ids

    # 3. Officer sees BOTH instruments
    q_officer = scope_to_institution(base_query, officer_user)
    res_officer = (await db_session.execute(q_officer)).scalars().all()
    res_officer_ids = {r.id for r in res_officer}
    assert inst1_instrument.id in res_officer_ids
    assert inst2_instrument.id in res_officer_ids

    # 4. Admin sees BOTH instruments
    q_admin = scope_to_institution(base_query, admin_user)
    res_admin = (await db_session.execute(q_admin)).scalars().all()
    res_admin_ids = {r.id for r in res_admin}
    assert inst1_instrument.id in res_admin_ids
    assert inst2_instrument.id in res_admin_ids
