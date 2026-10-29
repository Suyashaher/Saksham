"""Tests for the seed script idempotency and credentials."""

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import UserRole
from app.db.models.institution import Institution
from app.db.models.user import User
from app.scripts.seed_users import seed_data


@pytest.mark.asyncio
async def test_seed_script_creates_all_roles_and_is_idempotent(
    client: AsyncClient, db_session: AsyncSession
):
    # Run seed 1st time
    creds = await seed_data()
    assert len(creds) >= 5

    # Check that all roles are present
    user_roles_result = await db_session.execute(select(User.role))
    roles = {r.value if hasattr(r, "value") else str(r) for r in user_roles_result.scalars().all()}
    assert UserRole.ADMIN.value in roles
    assert UserRole.VERIFYING_OFFICER.value in roles
    assert UserRole.APPROVING_AUTHORITY.value in roles
    assert UserRole.INSTITUTION.value in roles

    # Check 2 institutions exist
    inst_count_res = await db_session.execute(select(func.count()).select_from(Institution))
    inst_count = inst_count_res.scalar_one()
    assert inst_count >= 2

    # Run seed 2nd time — must not crash or duplicate
    creds_second = await seed_data()
    assert len(creds_second) >= 5

    # Verify admin can login
    res_login = await client.post(
        "/auth/login",
        json={"email": "admin@aicte.gov.in", "password": creds["admin@aicte.gov.in"]},
    )
    assert res_login.status_code == 200
    assert "challenge_id" in res_login.json()
