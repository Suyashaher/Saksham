"""Tests for Admin User and Institution Management."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import UserRole
from app.db.models.institution import Institution
from app.db.models.user import User


@pytest.mark.asyncio
async def test_admin_create_officer_user(
    client: AsyncClient, admin_headers: dict
):
    email = f"new_officer_{uuid.uuid4().hex[:6]}@aicte.gov.in"
    res = await client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": email,
            "full_name": "New Verifying Officer",
            "password": "StrongPassword@2026!",
            "role": "VERIFYING_OFFICER",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == email
    assert data["role"] == "VERIFYING_OFFICER"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_admin_create_user_weak_password_rejected(
    client: AsyncClient, admin_headers: dict
):
    # Too short and lacking special chars
    res = await client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": "weak_pwd@aicte.gov.in",
            "full_name": "Weak User",
            "password": "weak",
            "role": "VERIFYING_OFFICER",
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_admin_create_institution_user_requires_institution_id(
    client: AsyncClient, admin_headers: dict
):
    res = await client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": "inst_no_id@example.ac.in",
            "full_name": "Institution User No ID",
            "password": "ValidPassword@2026!",
            "role": "INSTITUTION",
            # institution_id omitted
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_admin_create_institution_user_success(
    client: AsyncClient, admin_headers: dict, test_institution_1: Institution
):
    email = f"inst_user_{uuid.uuid4().hex[:6]}@alpha.ac.in"
    res = await client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": email,
            "full_name": "Alpha Registrar",
            "password": "ValidPassword@2026!",
            "role": "INSTITUTION",
            "institution_id": str(test_institution_1.id),
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == email
    assert data["institution_id"] == str(test_institution_1.id)


@pytest.mark.asyncio
async def test_admin_create_user_duplicate_email_rejected(
    client: AsyncClient, admin_headers: dict, admin_user: User
):
    res = await client.post(
        "/admin/users",
        headers=admin_headers,
        json={
            "email": admin_user.email,  # duplicate email
            "full_name": "Duplicate Admin",
            "password": "ValidPassword@2026!",
            "role": "ADMIN",
        },
    )
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]


@pytest.mark.asyncio
async def test_admin_list_users_with_filter(
    client: AsyncClient, admin_headers: dict
):
    res = await client.get("/admin/users?role=ADMIN", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    for item in data["items"]:
        assert item["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_admin_update_user_role_and_status(
    client: AsyncClient, admin_headers: dict, officer_user: User
):
    # Promote to APPROVING_AUTHORITY and deactivate
    res = await client.patch(
        f"/admin/users/{officer_user.id}",
        headers=admin_headers,
        json={"role": "APPROVING_AUTHORITY", "is_active": False},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "APPROVING_AUTHORITY"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_admin_create_and_list_institutions(
    client: AsyncClient, admin_headers: dict
):
    aicte_id = f"1-TEST-{uuid.uuid4().hex[:6]}"
    res_create = await client.post(
        "/admin/institutions",
        headers=admin_headers,
        json={
            "name": "Indian Institute of Science",
            "aicte_id": aicte_id,
            "state": "Karnataka",
            "contact_email": "dean@iisc.ac.in",
            "approval_cycle": "2025-2026",
        },
    )
    assert res_create.status_code == 201
    data = res_create.json()
    assert data["aicte_id"] == aicte_id

    # List institutions
    res_list = await client.get("/admin/institutions", headers=admin_headers)
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert any(i["aicte_id"] == aicte_id for i in list_data["items"])
