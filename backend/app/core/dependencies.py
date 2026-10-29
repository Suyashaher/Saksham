"""FastAPI security dependencies and row-level scoping helpers."""

from __future__ import annotations

import uuid
from typing import Any, Callable, Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.core.security import decode_token
from app.db.enums import UserRole
from app.db.models.user import User
from app.db.session import get_session

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Validate JWT access token and return the active User."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    res = await session.execute(select(User).where(User.id == user_uuid))
    user = res.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*allowed_roles: UserRole | str) -> Callable[[User], User]:
    """Dependency factory checking that current_user has one of the allowed roles."""
    normalized_roles: set[str] = {
        r.value if isinstance(r, UserRole) else str(r) for r in allowed_roles
    }

    async def _role_checker(user: User = Depends(get_current_user)) -> User:
        user_role_str = (
            user.role.value if hasattr(user.role, "value") else str(user.role)
        )
        if user_role_str not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{user_role_str}'",
            )
        return user

    return _role_checker


def scope_to_institution(
    query: Select,
    user: User,
    model_or_column: Any = None,
) -> Select:
    """Row-level scoping helper.

    - INSTITUTION: Restricts query to rows where institution_id == user.institution_id.
    - VERIFYING_OFFICER, APPROVING_AUTHORITY, ADMIN: Allowed to view all data (returns query as-is).
    """
    user_role_str = (
        user.role.value if hasattr(user.role, "value") else str(user.role)
    )

    if user_role_str != UserRole.INSTITUTION.value:
        return query

    if user.institution_id is None:
        return query.where(false())

    if model_or_column is not None:
        if hasattr(model_or_column, "institution_id"):
            return query.where(model_or_column.institution_id == user.institution_id)
        return query.where(model_or_column == user.institution_id)

    # If model_or_column is None, inspect the query's primary entity
    if hasattr(query, "column_descriptions") and query.column_descriptions:
        entity = query.column_descriptions[0].get("entity")
        if entity and hasattr(entity, "institution_id"):
            return query.where(entity.institution_id == user.institution_id)

    # Fallback if cannot determine column
    return query
