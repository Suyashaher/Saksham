"""Pydantic schemas for user management."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.core.security import validate_password_strength
from app.db.enums import UserRole


class CreateUserRequest(BaseModel):
    email: EmailStr
    phone: str | None = None
    full_name: str
    password: str
    role: UserRole
    institution_id: UUID | None = None

    @field_validator("password")
    @classmethod
    def password_strong_enough(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v

    @field_validator("institution_id")
    @classmethod
    def institution_required_for_role(cls, v: UUID | None, info) -> UUID | None:
        role = info.data.get("role")
        if role == UserRole.INSTITUTION and v is None:
            raise ValueError("institution_id is required for INSTITUTION role.")
        return v


class UpdateUserRequest(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    phone: str | None
    full_name: str
    role: str
    institution_id: UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
