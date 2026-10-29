"""Test migrations and verify all tables and current revision exist."""

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession

EXPECTED_TABLES = {
    "institutions",
    "users",
    "instruments",
    "documents",
    "verification_records",
    "renewal_links",
    "release_requests",
    "alerts",
    "audit_logs",
    "feedback_labels",
    "otp_challenges",
    "refresh_tokens",
    "failed_login_attempts",
}


@pytest.mark.asyncio
async def test_all_tables_exist(db_session: AsyncSession):
    def get_table_names(conn):
        inspector = inspect(conn)
        return set(inspector.get_table_names())

    existing_tables = await db_session.run_sync(get_table_names)
    assert EXPECTED_TABLES.issubset(
        existing_tables
    ), f"Missing tables: {EXPECTED_TABLES - existing_tables}"


@pytest.mark.asyncio
async def test_alembic_version_table_present(db_session: AsyncSession):
    result = await db_session.execute(
        text("SELECT version_num FROM alembic_version")
    )
    version = result.scalar()
    assert version == "002"
