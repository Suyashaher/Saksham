"""Tests for FDR instrument renewal, replacement, and lineage tracking."""

from __future__ import annotations

import datetime
from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.db.enums import FDRStatus, UserRole, VerificationTag
from app.db.models.instrument import Instrument
from app.db.models.user import User
from app.services.renewal_service import complete_renewal, get_lineage, initiate_renewal


@pytest.mark.asyncio
async def test_renewal_workflow(
    client: AsyncClient,
    db_session: AsyncSession,
    inst_user: User,
    admin_user: User,
    inst_token: str,
    approver_token: str,
):
    """Verify renewal lifecycle: initiate stub -> activate -> old RENEWED + lineage."""
    headers_inst = {"Authorization": f"Bearer {inst_token}"}
    headers_approver = {"Authorization": f"Bearer {approver_token}"}

    today_date = clock.today()

    # 1. Create an ACTIVE instrument for inst_user's institution
    old_inst = Instrument(
        institution_id=inst_user.institution_id,
        reference_number=f"FDR-OLD-{uuid.uuid4().hex[:6]}",
        issuing_bank="State Bank of India",
        branch="Main",
        amount=Decimal("200000.00"),
        required_amount=Decimal("200000.00"),
        issue_date=today_date - datetime.timedelta(days=365),
        maturity_date=today_date + datetime.timedelta(days=10),
        status=FDRStatus.ACTIVE,
        verification_tag=VerificationTag.BANK_VERIFIED,
    )
    db_session.add(old_inst)
    await db_session.commit()
    await db_session.refresh(old_inst)

    # 2. Initiate renewal via API
    renew_res = await client.post(
        f"/instruments/{old_inst.id}/renew",
        json={"amount": 250000.00},
        headers=headers_inst,
    )
    assert renew_res.status_code == 201
    new_inst_data = renew_res.json()
    new_id = uuid.UUID(new_inst_data["id"])
    assert new_inst_data["status"] == "SUBMITTED"
    assert Decimal(str(new_inst_data["amount"])) == Decimal("250000.00")

    # 3. Duplicate renewal while one is in progress fails with 409
    dup_res = await client.post(f"/instruments/{old_inst.id}/renew", headers=headers_inst)
    assert dup_res.status_code == 409

    # 4. Lineage shows new instrument as descendant of old
    lineage_res = await client.get(f"/instruments/{new_id}/lineage", headers=headers_inst)
    assert lineage_res.status_code == 200
    lineage = lineage_res.json()
    assert len(lineage["ancestors"]) == 1
    assert lineage["ancestors"][0]["id"] == str(old_inst.id)

    # 5. Move new instrument to VERIFIED and activate it
    new_inst = await db_session.get(Instrument, new_id)
    new_inst.status = FDRStatus.VERIFIED
    await db_session.commit()

    act_res = await client.post(f"/instruments/{new_id}/activate", headers=headers_approver)
    assert act_res.status_code == 200

    # 6. Verify old instrument is now RENEWED
    await db_session.refresh(old_inst)
    assert old_inst.status == FDRStatus.RENEWED

    # 7. Lineage reflects renewed status
    full_lineage = await get_lineage(db_session, old_inst.id)
    assert full_lineage["target"]["status"] == "RENEWED"
    assert len(full_lineage["descendants"]) == 1
    assert full_lineage["descendants"][0]["id"] == new_id
