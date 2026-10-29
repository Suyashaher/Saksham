"""Seed script for initial institutions and users.

Idempotent: Safe to execute multiple times.
Usage:
    python -m app.scripts.seed_users
"""

from __future__ import annotations

import asyncio
import os
import uuid

from sqlalchemy import select

from app.core.security import hash_password
from app.db.enums import UserRole
from app.db.models.institution import Institution
from app.db.models.user import User
from app.db.session import async_session_factory
from app.services.audit_service import AuditService

# Default strong seed passwords (min 10 chars, upper, lower, digit, symbol)
DEFAULT_ADMIN_PWD = os.getenv("SEED_ADMIN_PASSWORD", "Admin@AICTE2026!")
DEFAULT_OFFICER_PWD = os.getenv("SEED_OFFICER_PASSWORD", "Officer@AICTE2026!")
DEFAULT_APPROVER_PWD = os.getenv("SEED_APPROVER_PASSWORD", "Approver@AICTE2026!")
DEFAULT_INST1_PWD = os.getenv("SEED_INST1_PASSWORD", "Inst1@AICTE2026!")
DEFAULT_INST2_PWD = os.getenv("SEED_INST2_PASSWORD", "Inst2@AICTE2026!")

# UUID used as the actor for the very first seed audit entries (before SYSTEM user exists)
SYSTEM_SEED_ACTOR_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
# The real SYSTEM user row in the DB — used as actor for automated transitions
SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


async def seed_data() -> dict[str, str]:
    created_count = 0
    skipped_count = 0
    credentials: list[dict[str, str]] = []

    async with async_session_factory() as session:
        # --- 0. SYSTEM user (role=ADMIN, is_active=False, cannot authenticate) ---
        res = await session.execute(select(User).where(User.id == SYSTEM_USER_ID))
        system_user = res.scalar_one_or_none()
        if system_user is None:
            system_user = User(
                id=SYSTEM_USER_ID,
                email="system@fdr-portal.internal",
                full_name="FDR Portal System",
                hashed_password="!DISABLED!",  # Cannot be used to log in
                role=UserRole.ADMIN,
                is_active=False,
            )
            session.add(system_user)
            await session.flush()
            await AuditService.record(
                session,
                actor_id=SYSTEM_SEED_ACTOR_ID,
                action="system_user_created",
                entity_type="user",
                entity_id=system_user.id,
                payload={"email": system_user.email, "seed": True},
            )
            created_count += 1
        else:
            skipped_count += 1

        # --- 1. Institutions ---
        institutions_def = [
            {
                "name": "Delhi Technological University",
                "aicte_id": "1-DTU-DELHI",
                "state": "Delhi",
                "contact_email": "contact@dtu.ac.in",
                "contact_phone": "011-27871018",
                "approval_cycle": "2025-2026",
            },
            {
                "name": "College of Engineering Pune",
                "aicte_id": "1-COEP-PUNE",
                "state": "Maharashtra",
                "contact_email": "contact@coep.ac.in",
                "contact_phone": "020-25507000",
                "approval_cycle": "2025-2026",
            },
        ]

        institutions_map: dict[str, Institution] = {}
        for item in institutions_def:
            res = await session.execute(
                select(Institution).where(Institution.aicte_id == item["aicte_id"])
            )
            inst = res.scalar_one_or_none()
            if inst is None:
                inst = Institution(**item)
                session.add(inst)
                await session.flush()
                await AuditService.record(
                    session,
                    actor_id=SYSTEM_SEED_ACTOR_ID,
                    action="institution_created",
                    entity_type="institution",
                    entity_id=inst.id,
                    payload={"name": inst.name, "aicte_id": inst.aicte_id, "seed": True},
                )
                created_count += 1
            else:
                skipped_count += 1
            institutions_map[item["aicte_id"]] = inst

        # --- 2. Users ---
        users_def = [
            {
                "email": "admin@aicte.gov.in",
                "full_name": "AICTE Super Admin",
                "role": UserRole.ADMIN,
                "password": DEFAULT_ADMIN_PWD,
                "institution_id": None,
                "phone": "9999900001",
            },
            {
                "email": "officer@aicte.gov.in",
                "full_name": "Verifying Officer Sharma",
                "role": UserRole.VERIFYING_OFFICER,
                "password": DEFAULT_OFFICER_PWD,
                "institution_id": None,
                "phone": "9999900002",
            },
            {
                "email": "approver@aicte.gov.in",
                "full_name": "Bureau Head Verma",
                "role": UserRole.APPROVING_AUTHORITY,
                "password": DEFAULT_APPROVER_PWD,
                "institution_id": None,
                "phone": "9999900003",
            },
            {
                "email": "registrar@dtu.ac.in",
                "full_name": "DTU Registrar",
                "role": UserRole.INSTITUTION,
                "password": DEFAULT_INST1_PWD,
                "institution_id": institutions_map["1-DTU-DELHI"].id,
                "phone": "9999900004",
            },
            {
                "email": "registrar@coep.ac.in",
                "full_name": "COEP Registrar",
                "role": UserRole.INSTITUTION,
                "password": DEFAULT_INST2_PWD,
                "institution_id": institutions_map["1-COEP-PUNE"].id,
                "phone": "9999900005",
            },
        ]

        for item in users_def:
            pwd = item.pop("password")
            res = await session.execute(
                select(User).where(User.email == item["email"])
            )
            user = res.scalar_one_or_none()
            if user is None:
                user = User(
                    **item,
                    hashed_password=hash_password(pwd),
                    is_active=True,
                )
                session.add(user)
                await session.flush()
                await AuditService.record(
                    session,
                    actor_id=SYSTEM_SEED_ACTOR_ID,
                    action="user_created",
                    entity_type="user",
                    entity_id=user.id,
                    payload={"email": user.email, "role": user.role.value, "seed": True},
                )
                created_count += 1
            else:
                skipped_count += 1

            credentials.append({
                "email": item["email"],
                "role": item["role"].value if hasattr(item["role"], "value") else str(item["role"]),
                "password": pwd,
            })

        await session.commit()

    print("\n" + "=" * 65)
    print("AICTE FDR PORTAL - SEED DATA SUMMARY")
    print("=" * 65)
    print(f"Status: {created_count} entities created, {skipped_count} skipped (already present).\n")
    print(f"{'Role':<22} | {'Email':<25} | {'Password'}")
    print("-" * 65)
    for c in credentials:
        print(f"{c['role']:<22} | {c['email']:<25} | {c['password']}")
    print("=" * 65 + "\n")

    return {c["email"]: c["password"] for c in credentials}


def main():
    asyncio.run(seed_data())


if __name__ == "__main__":
    main()
