"""Tests for Authentication endpoints (login, OTP, tokens, logout, me)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_otp, hash_password
from app.db.enums import UserRole
from app.db.models.otp_challenge import OtpChallenge
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User


@pytest.mark.asyncio
async def test_login_success_creates_otp_challenge(
    client: AsyncClient, admin_user: User
):
    res = await client.post(
        "/auth/login",
        json={"email": admin_user.email, "password": "Admin@AICTE2026!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "challenge_id" in data
    assert "Verify to complete login" in data.get("message", "")


@pytest.mark.asyncio
async def test_login_invalid_password_generic_error(
    client: AsyncClient, admin_user: User
):
    res = await client.post(
        "/auth/login",
        json={"email": admin_user.email, "password": "WrongPassword@999"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_unknown_email_generic_error(client: AsyncClient):
    res = await client.post(
        "/auth/login",
        json={"email": "nonexistent_user@example.com", "password": "SomePassword@123"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_deactivated_user_rejected(
    client: AsyncClient, db_session: AsyncSession
):
    user = User(
        email=f"deactive_{uuid.uuid4().hex[:6]}@aicte.gov.in",
        full_name="Deactivated User",
        hashed_password=hash_password("Pass@12345678"),
        role=UserRole.INSTITUTION,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()

    res = await client.post(
        "/auth/login",
        json={"email": user.email, "password": "Pass@12345678"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_verify_otp_success(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    plain_otp = "123456"
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp(plain_otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        max_attempts=5,
        attempts=0,
    )
    db_session.add(challenge)
    await db_session.commit()
    await db_session.refresh(challenge)

    res = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": plain_otp},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Verify challenge is marked used
    await db_session.refresh(challenge)
    assert challenge.is_used is True


@pytest.mark.asyncio
async def test_verify_otp_invalid_otp(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp("123456"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        max_attempts=5,
        attempts=0,
    )
    db_session.add(challenge)
    await db_session.commit()
    await db_session.refresh(challenge)

    res = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": "999999"},
    )
    assert res.status_code == 401
    assert "Invalid or expired OTP" in res.json()["detail"]

    await db_session.refresh(challenge)
    assert challenge.attempts == 1


@pytest.mark.asyncio
async def test_verify_otp_expired(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp("123456"),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # expired
        max_attempts=5,
        attempts=0,
    )
    db_session.add(challenge)
    await db_session.commit()

    res = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": "123456"},
    )
    assert res.status_code == 401
    assert "Invalid or expired OTP" in res.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_already_used(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp("123456"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        max_attempts=5,
        attempts=1,
        is_used=True,  # already used
    )
    db_session.add(challenge)
    await db_session.commit()

    res = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": "123456"},
    )
    assert res.status_code == 401
    assert "Invalid or expired OTP" in res.json()["detail"]


@pytest.mark.asyncio
async def test_verify_otp_max_attempts_lockout(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp("123456"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        max_attempts=5,
        attempts=5,  # max reached
    )
    db_session.add(challenge)
    await db_session.commit()

    res = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": "123456"},
    )
    assert res.status_code == 401
    assert "Maximum OTP attempts exceeded" in res.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_token_rotation(
    client: AsyncClient, db_session: AsyncSession, admin_user: User
):
    # Step 1: Login + verify OTP to obtain real tokens
    plain_otp = "888888"
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp(plain_otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db_session.add(challenge)
    await db_session.commit()

    res_otp = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": plain_otp},
    )
    old_refresh = res_otp.json()["refresh_token"]

    # Step 2: Call /auth/refresh with the refresh token
    res_refresh = await client.post(
        "/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert res_refresh.status_code == 200
    new_data = res_refresh.json()
    new_refresh = new_data["refresh_token"]
    assert new_refresh != old_refresh

    # Step 3: Using the OLD refresh token again must fail (revoked)
    res_retry = await client.post(
        "/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert res_retry.status_code == 401
    assert "revoked" in res_retry.json()["detail"].lower()


@pytest.mark.asyncio
async def test_logout_revokes_token(
    client: AsyncClient, db_session: AsyncSession, admin_user: User, admin_headers: dict
):
    plain_otp = "777777"
    challenge = OtpChallenge(
        user_id=admin_user.id,
        otp_hash=hash_otp(plain_otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db_session.add(challenge)
    await db_session.commit()

    res_otp = await client.post(
        "/auth/verify-otp",
        json={"challenge_id": str(challenge.id), "otp": plain_otp},
    )
    refresh_token = res_otp.json()["refresh_token"]

    # Logout
    res_logout = await client.post(
        "/auth/logout",
        headers=admin_headers,
        json={"refresh_token": refresh_token},
    )
    assert res_logout.status_code == 200
    assert res_logout.json()["status"] == "logged_out"

    # Trying to refresh with the logged out token must fail
    res_try = await client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert res_try.status_code == 401


@pytest.mark.asyncio
async def test_get_me(
    client: AsyncClient, admin_user: User, admin_headers: dict
):
    res = await client.get("/auth/me", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == admin_user.email
    assert data["role"] == admin_user.role.value
