"""Authentication service — login, OTP, tokens, logout."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_otp,
    hash_password,
    hash_token,
    verify_otp,
    verify_password,
)
from app.db.models.failed_login import FailedLoginAttempt
from app.db.models.otp_challenge import OtpChallenge
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.services.audit_service import AuditService
from app.services.otp_sender import get_otp_sender

# Nil UUID for unknown users in audit log
NIL_UUID = uuid.UUID("00000000-0000-0000-0000-000000000000")


class AuthService:
    """Handles the full authentication lifecycle."""

    @staticmethod
    async def login(
        session: AsyncSession,
        email: str,
        password: str,
        ip_address: str | None = None,
    ) -> dict:
        """Step 1: validate credentials, create OTP challenge.

        Returns a dict with keys depending on settings:
        - REQUIRE_OTP=true: {challenge_id, otp?}
        - REQUIRE_OTP=false: {access_token, refresh_token, ...}
        """
        settings = get_settings()

        # Look up user
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if user is None or not verify_password(password, user.hashed_password):
            # Record failure
            fail = FailedLoginAttempt(email=email, ip_address=ip_address)
            session.add(fail)
            await AuditService.record(
                session,
                actor_id=user.id if user else None,
                action="login_failure",
                entity_type="user",
                entity_id=user.id if user else NIL_UUID,
                payload={"email": email, "ip": ip_address, "reason": "invalid_credentials"},
            )
            await session.commit()
            return {"error": "Invalid credentials"}

        if not user.is_active:
            await AuditService.record(
                session,
                actor_id=user.id,
                action="login_failure",
                entity_type="user",
                entity_id=user.id,
                payload={"email": email, "ip": ip_address, "reason": "account_inactive"},
            )
            await session.commit()
            return {"error": "Invalid credentials"}

        # ── REQUIRE_OTP = false → issue tokens directly ──
        if not settings.REQUIRE_OTP:
            tokens = await AuthService._issue_tokens(session, user, ip_address)
            return tokens

        # ── REQUIRE_OTP = true → create OTP challenge ───
        otp_plain = generate_otp()
        otp_hashed = hash_otp(otp_plain)

        challenge = OtpChallenge(
            user_id=user.id,
            otp_hash=otp_hashed,
            expires_at=datetime.now(timezone.utc)
            + timedelta(seconds=settings.OTP_EXPIRE_SECONDS),
            max_attempts=settings.OTP_MAX_ATTEMPTS,
        )
        session.add(challenge)
        await session.flush()  # get the id

        # Send OTP
        sender = get_otp_sender()
        await sender.send(user, otp_plain)

        result_data: dict = {
            "challenge_id": challenge.id,
            "message": "OTP sent. Verify to complete login.",
        }

        if settings.DEV_EXPOSE_OTP:
            result_data["otp"] = otp_plain

        await session.commit()
        return result_data

    @staticmethod
    async def verify_otp_challenge(
        session: AsyncSession,
        challenge_id: uuid.UUID,
        otp: str,
        ip_address: str | None = None,
    ) -> dict:
        """Step 2: verify OTP and issue tokens."""
        result = await session.execute(
            select(OtpChallenge).where(OtpChallenge.id == challenge_id)
        )
        challenge = result.scalar_one_or_none()

        if challenge is None:
            return {"error": "Invalid or expired OTP"}

        now = datetime.now(timezone.utc)

        # Check expiry
        if now > challenge.expires_at:
            return {"error": "Invalid or expired OTP"}

        # Check if already used
        if challenge.is_used:
            return {"error": "Invalid or expired OTP"}

        # Check attempts
        if challenge.attempts >= challenge.max_attempts:
            await AuditService.record(
                session,
                actor_id=challenge.user_id,
                action="otp_failure",
                entity_type="user",
                entity_id=challenge.user_id,
                payload={"challenge_id": str(challenge_id), "reason": "max_attempts_exceeded"},
            )
            await session.commit()
            return {"error": "Maximum OTP attempts exceeded"}

        # Increment attempts
        challenge.attempts += 1

        # Verify
        if not verify_otp(otp, challenge.otp_hash):
            await AuditService.record(
                session,
                actor_id=challenge.user_id,
                action="otp_failure",
                entity_type="user",
                entity_id=challenge.user_id,
                payload={"challenge_id": str(challenge_id), "reason": "wrong_otp"},
            )
            await session.commit()
            return {"error": "Invalid or expired OTP"}

        # Mark used
        challenge.is_used = True

        # Load user
        user_result = await session.execute(
            select(User).where(User.id == challenge.user_id)
        )
        user = user_result.scalar_one()

        tokens = await AuthService._issue_tokens(session, user, ip_address)
        return tokens

    @staticmethod
    async def _issue_tokens(
        session: AsyncSession,
        user: User,
        ip_address: str | None = None,
    ) -> dict:
        """Create access + refresh tokens, store refresh, audit login."""
        settings = get_settings()

        access = create_access_token(
            user_id=user.id,
            role=user.role.value if hasattr(user.role, "value") else user.role,
            institution_id=user.institution_id,
        )
        raw_refresh, jti, expires_at = create_refresh_token(user_id=user.id)

        # Store refresh token (hashed)
        rt = RefreshToken(
            user_id=user.id,
            jti=jti,
            token_hash=hash_token(raw_refresh),
            expires_at=expires_at,
        )
        session.add(rt)

        await AuditService.record(
            session,
            actor_id=user.id,
            action="login_success",
            entity_type="user",
            entity_id=user.id,
            payload={"email": user.email, "ip": ip_address},
        )
        await session.commit()

        return {
            "access_token": access,
            "refresh_token": raw_refresh,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    async def refresh(session: AsyncSession, raw_refresh_token: str) -> dict:
        """Rotate a refresh token — revoke old, issue new pair."""
        settings = get_settings()

        try:
            claims = decode_token(raw_refresh_token)
        except Exception:
            return {"error": "Invalid token"}

        if claims.get("type") != "refresh":
            return {"error": "Invalid token"}

        jti = claims.get("jti")
        user_id = claims.get("sub")

        if not jti or not user_id:
            return {"error": "Invalid token"}

        # Find the stored refresh token
        result = await session.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        stored = result.scalar_one_or_none()

        if stored is None or stored.is_revoked:
            return {"error": "Token revoked"}

        if datetime.now(timezone.utc) > stored.expires_at:
            return {"error": "Token expired"}

        # Revoke old token
        stored.is_revoked = True

        # Load user
        user_result = await session.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = user_result.scalar_one_or_none()
        if user is None or not user.is_active:
            return {"error": "User not found or inactive"}

        # Issue new pair
        access = create_access_token(
            user_id=user.id,
            role=user.role.value if hasattr(user.role, "value") else user.role,
            institution_id=user.institution_id,
        )
        new_raw, new_jti, new_exp = create_refresh_token(user_id=user.id)
        new_rt = RefreshToken(
            user_id=user.id,
            jti=new_jti,
            token_hash=hash_token(new_raw),
            expires_at=new_exp,
        )
        session.add(new_rt)
        await session.commit()

        return {
            "access_token": access,
            "refresh_token": new_raw,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    @staticmethod
    async def logout(
        session: AsyncSession,
        raw_refresh_token: str,
        actor_id: uuid.UUID,
    ) -> bool:
        """Revoke a refresh token."""
        try:
            claims = decode_token(raw_refresh_token)
        except Exception:
            return False

        jti = claims.get("jti")
        if not jti:
            return False

        result = await session.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        stored = result.scalar_one_or_none()
        if stored is None:
            return False

        stored.is_revoked = True

        await AuditService.record(
            session,
            actor_id=actor_id,
            action="logout",
            entity_type="user",
            entity_id=actor_id,
            payload={},
        )
        await session.commit()
        return True
