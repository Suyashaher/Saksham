"""Pytest fixtures for database, test client, and test environment."""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.enums import UserRole
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.db.session import get_session
from app.main import create_app

settings = get_settings()
TEST_DB_URL = os.getenv("TEST_DATABASE_URL", settings.DATABASE_URL)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create a persistent engine for the test session."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session rolled back after test."""
    session_factory = async_sessionmaker(
        bind=db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for testing FastAPI endpoints with overridden session dependency."""
    app = create_app()

    async def _get_test_session():
        yield db_session

    app.dependency_overrides[get_session] = _get_test_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ── Seeded entity fixtures for tests ─────────────────────

@pytest_asyncio.fixture(scope="function")
async def test_institution_1(db_session: AsyncSession) -> Institution:
    inst = Institution(
        name="Institute Alpha",
        aicte_id=f"AICTE-A-{uuid.uuid4().hex[:6]}",
        state="Maharashtra",
        contact_email="alpha@test.ac.in",
        contact_phone="1234567890",
        approval_cycle="2025-2026",
    )
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)
    return inst


@pytest_asyncio.fixture(scope="function")
async def test_institution_2(db_session: AsyncSession) -> Institution:
    inst = Institution(
        name="Institute Beta",
        aicte_id=f"AICTE-B-{uuid.uuid4().hex[:6]}",
        state="Delhi",
        contact_email="beta@test.ac.in",
        contact_phone="9876543210",
        approval_cycle="2025-2026",
    )
    db_session.add(inst)
    await db_session.commit()
    await db_session.refresh(inst)
    return inst


@pytest_asyncio.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@aicte.gov.in",
        full_name="Admin User",
        hashed_password=hash_password("Admin@AICTE2026!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def officer_user(db_session: AsyncSession) -> User:
    user = User(
        email=f"officer_{uuid.uuid4().hex[:6]}@aicte.gov.in",
        full_name="Verifying Officer",
        hashed_password=hash_password("Officer@AICTE2026!"),
        role=UserRole.VERIFYING_OFFICER,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def approver_user(db_session: AsyncSession) -> User:
    user = User(
        email=f"approver_{uuid.uuid4().hex[:6]}@aicte.gov.in",
        full_name="Approving Authority",
        hashed_password=hash_password("Approver@AICTE2026!"),
        role=UserRole.APPROVING_AUTHORITY,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def institution_user_1(
    db_session: AsyncSession, test_institution_1: Institution
) -> User:
    user = User(
        email=f"inst1_{uuid.uuid4().hex[:6]}@alpha.ac.in",
        full_name="Alpha Inst User",
        hashed_password=hash_password("Inst1@AICTE2026!"),
        role=UserRole.INSTITUTION,
        institution_id=test_institution_1.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def institution_user_2(
    db_session: AsyncSession, test_institution_2: Institution
) -> User:
    user = User(
        email=f"inst2_{uuid.uuid4().hex[:6]}@beta.ac.in",
        full_name="Beta Inst User",
        hashed_password=hash_password("Inst2@AICTE2026!"),
        role=UserRole.INSTITUTION,
        institution_id=test_institution_2.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ── Token header helpers ─────────────────────────────────

@pytest.fixture
def admin_headers(admin_user: User) -> dict[str, str]:
    token = create_access_token(admin_user.id, role=admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def officer_headers(officer_user: User) -> dict[str, str]:
    token = create_access_token(officer_user.id, role=officer_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def approver_headers(approver_user: User) -> dict[str, str]:
    token = create_access_token(approver_user.id, role=approver_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def inst1_headers(institution_user_1: User) -> dict[str, str]:
    token = create_access_token(
        institution_user_1.id,
        role=institution_user_1.role.value,
        institution_id=institution_user_1.institution_id,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def inst2_headers(institution_user_2: User) -> dict[str, str]:
    token = create_access_token(
        institution_user_2.id,
        role=institution_user_2.role.value,
        institution_id=institution_user_2.institution_id,
    )
    return {"Authorization": f"Bearer {token}"}
