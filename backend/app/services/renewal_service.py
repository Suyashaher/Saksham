"""Renewal service — manage instrument renewals, replacements, and lineage."""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.db.enums import FDRStatus, VerificationTag
from app.db.models.instrument import Instrument
from app.db.models.renewal import RenewalLink
from app.db.models.user import User
from app.services.audit_service import AuditService
from app.services.escalation import auto_resolve_alerts
from app.services.instrument_state import transition


class RenewalError(Exception):
    """Raised when renewal validation fails."""
    pass


async def initiate_renewal(
    session: AsyncSession,
    old_instrument_id: uuid.UUID,
    actor: User,
    reference_number: str | None = None,
    amount: Decimal | None = None,
    maturity_date: datetime.date | None = None,
) -> Instrument:
    """Initiate renewal for an existing instrument (INSTITUTION only).

    Allowed only when instrument status is ACTIVE, EXPIRING, or MATURED.
    Raises 409 if an open renewal or replacement already exists.
    Creates a new stub Instrument with status=SUBMITTED and replaces_instrument_id pointing to old.
    Note: RenewalLink is created later, when the new instrument reaches ACTIVE.
    """
    stmt = (
        select(Instrument)
        .where(Instrument.id == old_instrument_id)
        .options(selectinload(Instrument.institution))
    )
    res = await session.execute(stmt)
    old = res.scalar_one_or_none()
    if not old:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    # Scope check: actor must belong to the same institution
    if actor.institution_id != old.institution_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    # Status check: only ACTIVE, EXPIRING, or MATURED instruments can be renewed
    if old.status not in {FDRStatus.ACTIVE, FDRStatus.EXPIRING, FDRStatus.MATURED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot renew instrument in {old.status.value} status (must be ACTIVE, EXPIRING, or MATURED)",
        )

    # Check for existing completed renewal
    existing_link = await session.execute(
        select(RenewalLink).where(RenewalLink.old_instrument_id == old.id)
    )
    if existing_link.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This instrument has already been renewed",
        )

    # Check for existing open renewal attempt (another instrument replacing this one that is not rejected/closed)
    existing_pending = await session.execute(
        select(Instrument).where(Instrument.replaces_instrument_id == old.id)
    )
    if existing_pending.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A renewal application is already in progress for this instrument",
        )

    # Generate reference number if not supplied
    ref_num = reference_number or f"REN-{old.reference_number}-{uuid.uuid4().hex[:6].upper()}"
    new_issue_date = clock.today()
    new_maturity_date = maturity_date or (new_issue_date + datetime.timedelta(days=365))
    new_amount = amount if amount is not None else old.amount

    new_inst = Instrument(
        institution_id=old.institution_id,
        reference_number=ref_num,
        issuing_bank=old.issuing_bank,
        branch=old.branch,
        amount=new_amount,
        required_amount=old.required_amount,
        issue_date=new_issue_date,
        maturity_date=new_maturity_date,
        status=FDRStatus.SUBMITTED,
        verification_tag=VerificationTag.SELF_DECLARED,
        replaces_instrument_id=old.id,
    )
    session.add(new_inst)
    await session.flush()

    await AuditService.record(
        session,
        actor_id=actor.id,
        action="renewal_initiated",
        entity_type="instrument",
        entity_id=new_inst.id,
        payload={
            "old_instrument_id": str(old.id),
            "new_instrument_id": str(new_inst.id),
            "old_reference_number": old.reference_number,
            "new_reference_number": new_inst.reference_number,
        },
    )

    return new_inst


async def complete_renewal(
    session: AsyncSession,
    new_instrument: Instrument,
    actor: User,
) -> RenewalLink | None:
    """Complete renewal when new_instrument reaches ACTIVE status.

    - Transitions old instrument to RENEWED
    - Creates RenewalLink with renewed_after_maturity flag
    - Resolves all active alerts on old instrument
    - Atomic within caller transaction
    """
    if not new_instrument.replaces_instrument_id:
        return None

    stmt = select(Instrument).where(Instrument.id == new_instrument.replaces_instrument_id)
    res = await session.execute(stmt)
    old = res.scalar_one_or_none()
    if not old:
        return None

    # Check if already renewed to ensure idempotency
    existing_link_res = await session.execute(
        select(RenewalLink).where(
            RenewalLink.old_instrument_id == old.id,
            RenewalLink.new_instrument_id == new_instrument.id,
        )
    )
    existing_link = existing_link_res.scalar_one_or_none()
    if existing_link:
        return existing_link

    # Determine if renewed after maturity
    today_date = clock.today()
    was_matured = (old.status == FDRStatus.MATURED) or (old.maturity_date < today_date)

    # Transition old instrument to RENEWED
    await transition(
        session,
        old,
        FDRStatus.RENEWED,
        actor,
        note=f"Renewed by replacement instrument {new_instrument.reference_number} ({new_instrument.id})",
    )

    # Create RenewalLink
    link = RenewalLink(
        old_instrument_id=old.id,
        new_instrument_id=new_instrument.id,
        renewed_after_maturity=was_matured,
    )
    session.add(link)

    # Auto-resolve any remaining alerts on the old instrument
    await auto_resolve_alerts(session, old.id, reason="instrument_renewed")

    await session.flush()

    await AuditService.record(
        session,
        actor_id=actor.id,
        action="renewal_completed",
        entity_type="renewal_link",
        entity_id=link.id,
        payload={
            "old_instrument_id": str(old.id),
            "new_instrument_id": str(new_instrument.id),
            "renewed_after_maturity": was_matured,
        },
    )

    return link


async def get_lineage(session: AsyncSession, instrument_id: uuid.UUID) -> dict:
    """Return the full renewal lineage chain (ancestors and descendants) for an instrument."""
    # Load target instrument
    res = await session.execute(
        select(Instrument).where(Instrument.id == instrument_id)
    )
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    # Trace backwards (ancestors via replaces_instrument_id)
    ancestors: list[dict] = []
    curr = target
    while curr.replaces_instrument_id is not None:
        p_res = await session.execute(
            select(Instrument).where(Instrument.id == curr.replaces_instrument_id)
        )
        parent = p_res.scalar_one_or_none()
        if not parent:
            break
        # Get renewal link info if exists
        link_res = await session.execute(
            select(RenewalLink).where(
                RenewalLink.old_instrument_id == parent.id,
                RenewalLink.new_instrument_id == curr.id,
            )
        )
        link = link_res.scalar_one_or_none()
        ancestors.append({
            "id": parent.id,
            "reference_number": parent.reference_number,
            "status": parent.status.value,
            "amount": float(parent.amount),
            "issue_date": parent.issue_date.isoformat(),
            "maturity_date": parent.maturity_date.isoformat(),
            "renewed_after_maturity": link.renewed_after_maturity if link else False,
        })
        curr = parent

    ancestors.reverse()  # root first

    # Trace forwards (descendants via replaced_by / replacement)
    descendants: list[dict] = []
    curr = target
    while True:
        c_res = await session.execute(
            select(Instrument).where(Instrument.replaces_instrument_id == curr.id)
        )
        child = c_res.scalar_one_or_none()
        if not child:
            break
        link_res = await session.execute(
            select(RenewalLink).where(
                RenewalLink.old_instrument_id == curr.id,
                RenewalLink.new_instrument_id == child.id,
            )
        )
        link = link_res.scalar_one_or_none()
        descendants.append({
            "id": child.id,
            "reference_number": child.reference_number,
            "status": child.status.value,
            "amount": float(child.amount),
            "issue_date": child.issue_date.isoformat(),
            "maturity_date": child.maturity_date.isoformat(),
            "renewed_after_maturity": link.renewed_after_maturity if link else False,
        })
        curr = child

    target_info = {
        "id": target.id,
        "reference_number": target.reference_number,
        "status": target.status.value,
        "amount": float(target.amount),
        "issue_date": target.issue_date.isoformat(),
        "maturity_date": target.maturity_date.isoformat(),
        "replaces_instrument_id": target.replaces_instrument_id,
    }

    return {
        "target": target_info,
        "ancestors": ancestors,
        "descendants": descendants,
        "full_chain": ancestors + [target_info] + descendants,
    }
