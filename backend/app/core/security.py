"""Security utilities: password hashing, JWT tokens, OTP generation."""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

# ── Password hashing ────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Check *plain* against a bcrypt *hashed* value."""
    return pwd_context.verify(plain, hashed)


# ── OTP ──────────────────────────────────────────────────

def generate_otp() -> str:
    """Return a 6-digit OTP string using cryptographic randomness."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    """Hash an OTP using bcrypt (same as passwords)."""
    return pwd_context.hash(otp)


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify an OTP against its bcrypt hash."""
    return pwd_context.verify(plain_otp, hashed_otp)


# ── JWT ──────────────────────────────────────────────────

def create_access_token(
    user_id: UUID,
    role: str,
    institution_id: UUID | None = None,
) -> str:
    """Create a short-lived access token."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    jti = secrets.token_hex(16)
    payload = {
        "sub": str(user_id),
        "role": role,
        "institution_id": str(institution_id) if institution_id else None,
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> tuple[str, str, datetime]:
    """Create a long-lived refresh token.

    Returns (raw_token, jti, expires_at).
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    jti = secrets.token_hex(16)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": expires_at,
        "type": "refresh",
    }
    raw = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return raw, jti, expires_at


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def hash_token(raw_token: str) -> str:
    """SHA-256 hash for storing refresh tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ── Audit hash chain ────────────────────────────────────

def compute_audit_hash(
    prev_hash: str,
    user_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: UUID,
    payload: dict | None,
    created_at: datetime,
) -> str:
    """Compute SHA-256 for an audit log entry."""
    canonical = "|".join([
        prev_hash,
        str(user_id) if user_id else "",
        action,
        entity_type,
        str(entity_id),
        json.dumps(payload or {}, sort_keys=True, default=str),
        created_at.isoformat(),
    ])
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ── Payload redaction ────────────────────────────────────

REDACT_KEYS = frozenset({
    "password", "hashed_password", "otp", "token", "secret",
    "access_token", "refresh_token", "jwt", "otp_hash",
})


def redact_payload(payload: dict | None) -> dict:
    """Recursively replace sensitive values with '[REDACTED]'."""
    if payload is None:
        return {}
    result = {}
    for key, value in payload.items():
        if key.lower() in REDACT_KEYS:
            result[key] = "[REDACTED]"
        elif isinstance(value, dict):
            result[key] = redact_payload(value)
        else:
            result[key] = value
    return result


# ── Password policy ──────────────────────────────────────

def validate_password_strength(password: str) -> list[str]:
    """Return a list of policy violation messages (empty = valid)."""
    errors: list[str] = []
    if len(password) < 10:
        errors.append("Password must be at least 10 characters.")
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter.")
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one digit.")
    if not any(c in "!@#$%^&*()-_=+[]{}|;:',.<>?/`~" for c in password):
        errors.append("Password must contain at least one special character.")
    return errors
