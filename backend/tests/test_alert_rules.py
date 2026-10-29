"""Tests for AlertRule admin CRUD operations and access control."""

from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient

from app.db.enums import AlertChannel, AlertRuleType, UserRole
from app.db.models.alert_rule import AlertRule


@pytest.mark.asyncio
async def test_alert_rules_admin_crud(
    client: AsyncClient,
    admin_token: str,
    officer_token: str,
):
    """Admin can CRUD alert rules; non-admin receives 403."""
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_officer = {"Authorization": f"Bearer {officer_token}"}

    # 1. Non-admin cannot list rules -> 403
    res = await client.get("/alert-rules", headers=headers_officer)
    assert res.status_code == 403

    # 2. Admin creates rule
    rule_payload = {
        "name": f"Test Reminder {uuid.uuid4().hex[:6]}",
        "rule_type": "MATURITY_REMINDER",
        "days": 45,
        "channels": ["EMAIL", "IN_APP"],
        "recipient_role": "INSTITUTION",
        "escalate_after_days": 7,
        "is_active": True,
    }
    create_res = await client.post("/alert-rules", json=rule_payload, headers=headers_admin)
    assert create_res.status_code == 201
    created = create_res.json()
    rule_id = created["id"]
    assert created["days"] == 45
    assert created["channels"] == ["EMAIL", "IN_APP"]

    # 3. Duplicate name rejected -> 409
    dup_res = await client.post("/alert-rules", json=rule_payload, headers=headers_admin)
    assert dup_res.status_code == 409

    # 4. Get by ID
    get_res = await client.get(f"/alert-rules/{rule_id}", headers=headers_admin)
    assert get_res.status_code == 200
    assert get_res.json()["name"] == rule_payload["name"]

    # 5. Patch rule
    patch_res = await client.patch(
        f"/alert-rules/{rule_id}",
        json={"days": 50, "escalate_after_days": 10},
        headers=headers_admin,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["days"] == 50
    assert patch_res.json()["escalate_after_days"] == 10

    # 6. Soft delete
    del_res = await client.delete(f"/alert-rules/{rule_id}", headers=headers_admin)
    assert del_res.status_code == 200
    assert del_res.json()["is_active"] is False

    # 7. List rules with filter
    list_active = await client.get("/alert-rules?is_active=true", headers=headers_admin)
    assert list_active.status_code == 200
    active_ids = [r["id"] for r in list_active.json()]
    assert rule_id not in active_ids
