"""User management service (Admin)."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.enums import UserRole
from app.db.models.institution import Institution
from app.db.models.user import User
from app.schemas.user import CreateUserRequest, UpdateUserRequest
from app.services.audit_service import AuditService


class UserService:
    @staticmethod
    async def create_user(
        session: AsyncSession,
        req: CreateUserRequest,
        actor_id: uuid.UUID,
    ) -> User:
        # Check if email exists
        existing = await session.execute(
            select(User).where(User.email == req.email)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"User with email '{req.email}' already exists.")

        # If institution role, verify institution exists
        if req.role == UserRole.INSTITUTION:
            if not req.institution_id:
                raise ValueError("institution_id is required for INSTITUTION role.")
            inst = await session.execute(
                select(Institution).where(Institution.id == req.institution_id)
            )
            if not inst.scalar_one_or_none():
                raise ValueError(f"Institution with id '{req.institution_id}' not found.")
        elif req.institution_id:
            # Check institution if supplied for non-institution role
            inst = await session.execute(
                select(Institution).where(Institution.id == req.institution_id)
            )
            if not inst.scalar_one_or_none():
                raise ValueError(f"Institution with id '{req.institution_id}' not found.")

        user = User(
            email=req.email,
            phone=req.phone,
            full_name=req.full_name,
            hashed_password=hash_password(req.password),
            role=req.role,
            institution_id=req.institution_id,
            is_active=True,
        )
        session.add(user)
        await session.flush()

        await AuditService.record(
            session,
            actor_id=actor_id,
            action="user_created",
            entity_type="user",
            entity_id=user.id,
            payload={
                "email": user.email,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "institution_id": str(user.institution_id) if user.institution_id else None,
                "full_name": user.full_name,
            },
        )
        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def list_users(
        session: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        role: UserRole | None = None,
        institution_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> tuple[Sequence[User], int]:
        query = select(User)
        count_query = select(func.count()).select_from(User)

        if role:
            query = query.where(User.role == role)
            count_query = count_query.where(User.role == role)
        if institution_id:
            query = query.where(User.institution_id == institution_id)
            count_query = count_query.where(User.institution_id == institution_id)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)
        if search:
            search_pat = f"%{search}%"
            query = query.where(
                User.full_name.ilike(search_pat) | User.email.ilike(search_pat)
            )
            count_query = count_query.where(
                User.full_name.ilike(search_pat) | User.email.ilike(search_pat)
            )

        total_res = await session.execute(count_query)
        total = total_res.scalar_one()

        query = (
            query.order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        res = await session.execute(query)
        return res.scalars().all(), total

    @staticmethod
    async def update_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        req: UpdateUserRequest,
        actor_id: uuid.UUID,
    ) -> User:
        res = await session.execute(select(User).where(User.id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            raise ValueError(f"User with id '{user_id}' not found.")

        if req.role is not None and req.role != user.role:
            old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
            new_role = req.role.value if hasattr(req.role, "value") else str(req.role)
            user.role = req.role
            await AuditService.record(
                session,
                actor_id=actor_id,
                action="role_changed",
                entity_type="user",
                entity_id=user.id,
                payload={"old_role": old_role, "new_role": new_role},
            )

        if req.is_active is not None and req.is_active != user.is_active:
            user.is_active = req.is_active
            action = "user_activated" if req.is_active else "user_deactivated"
            await AuditService.record(
                session,
                actor_id=actor_id,
                action=action,
                entity_type="user",
                entity_id=user.id,
                payload={"is_active": user.is_active},
            )

        await session.commit()
        await session.refresh(user)
        return user
