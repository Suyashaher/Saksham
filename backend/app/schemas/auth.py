"""Pydantic schemas for authentication endpoints."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    challenge_id: UUID
    message: str = "OTP sent. Verify to complete login."
    otp: str | None = None  # only set when DEV_EXPOSE_OTP=true


class LoginDirectResponse(BaseModel):
    """Returned when REQUIRE_OTP=false (tokens directly)."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class VerifyOtpRequest(BaseModel):
    challenge_id: UUID
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    institution_id: UUID | None
    is_active: bool
