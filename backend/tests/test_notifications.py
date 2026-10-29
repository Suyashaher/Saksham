"""Tests for in-app notifications and user inbox."""

from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User
from app.services.notification_service import create_notification


@pytest.mark.asyncio
async def test_notifications_flow(
    client: AsyncClient,
    db_session: AsyncSession,
    inst_user: User,
    inst_token: str,
    admin_token: str,
):
    """Verify in-app notification listing, mark-as-read, and mark-all-read."""
    headers_inst = {"Authorization": f"Bearer {inst_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create two notifications for inst_user
    n1 = await create_notification(
        db_session,
        user_id=inst_user.id,
        title="Notice 1",
        body="Body 1",
    )
    n2 = await create_notification(
        db_session,
        user_id=inst_user.id,
        title="Notice 2",
        body="Body 2",
    )
    await db_session.commit()

    # 2. List notifications as inst_user
    res = await client.get("/notifications", headers=headers_inst)
    assert res.status_code == 200
    items = res.json()
    ids = [item["id"] for item in items]
    assert str(n1.id) in ids
    assert str(n2.id) in ids

    # 3. Admin cannot see inst_user's notifications in their own inbox
    admin_res = await client.get("/notifications", headers=headers_admin)
    assert admin_res.status_code == 200
    admin_ids = [item["id"] for item in admin_res.json()]
    assert str(n1.id) not in admin_ids

    # 4. Mark n1 as read
    read_res = await client.post(f"/notifications/{n1.id}/read", headers=headers_inst)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 5. Filter unread_only=true
    unread_res = await client.get("/notifications?unread_only=true", headers=headers_inst)
    assert unread_res.status_code == 200
    unread_ids = [item["id"] for item in unread_res.json()]
    assert str(n1.id) not in unread_ids
    assert str(n2.id) in unread_ids

    # 6. Mark all read
    all_read_res = await client.post("/notifications/read-all", headers=headers_inst)
    assert all_read_res.status_code == 200
    assert all_read_res.json()["marked_read"] >= 1

    # Now unread list is empty
    empty_res = await client.get("/notifications?unread_only=true", headers=headers_inst)
    assert empty_res.status_code == 200
    assert len(empty_res.json()) == 0
