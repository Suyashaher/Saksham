"""Institution management service (Admin)."""

from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.institution import Institution
from app.schemas.institution import CreateInstitutionRequest
from app.services.audit_service import AuditService


class InstitutionService:
    @staticmethod
    async def create_institution(
        session: AsyncSession,
        req: CreateInstitutionRequest,
        actor_id: uuid.UUID,
    ) -> Institution:
        # Check unique aicte_id
        existing = await session.execute(
            select(Institution).where(Institution.aicte_id == req.aicte_id)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Institution with AICTE ID '{req.aicte_id}' already exists.")

        inst = Institution(
            name=req.name,
            aicte_id=req.aicte_id,
            state=req.state,
            contact_email=req.contact_email,
            contact_phone=req.contact_phone,
            approval_cycle=req.approval_cycle,
        )
        session.add(inst)
        await session.flush()

        await AuditService.record(
            session,
            actor_id=actor_id,
            action="institution_created",
            entity_type="institution",
            entity_id=inst.id,
            payload={
                "name": inst.name,
                "aicte_id": inst.aicte_id,
                "state": inst.state,
                "contact_email": inst.contact_email,
            },
        )
        await session.commit()
        await session.refresh(inst)
        return inst

    @staticmethod
    async def list_institutions(
        session: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        state: str | None = None,
        search: str | None = None,
    ) -> tuple[Sequence[Institution], int]:
        query = select(Institution)
        count_query = select(func.count()).select_from(Institution)

        if state:
            query = query.where(Institution.state.ilike(f"%{state}%"))
            count_query = count_query.where(Institution.state.ilike(f"%{state}%"))
        if search:
            search_pat = f"%{search}%"
            query = query.where(
                Institution.name.ilike(search_pat) | Institution.aicte_id.ilike(search_pat)
            )
            count_query = count_query.where(
                Institution.name.ilike(search_pat) | Institution.aicte_id.ilike(search_pat)
            )

        total_res = await session.execute(count_query)
        total = total_res.scalar_one()

        query = (
            query.order_by(Institution.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        res = await session.execute(query)
        return res.scalars().all(), total
