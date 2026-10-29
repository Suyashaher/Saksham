"""Central FDR instrument state machine — single source of truth for transitions."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import FDRStatus
from app.db.models.instrument import Instrument
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.user import User
from app.services.audit_service import AuditService

ALLOWED_TRANSITIONS: dict[FDRStatus, set[FDRStatus]] = {
    FDRStatus.SUBMITTED: {FDRStatus.UNDER_SCRUTINY},
    FDRStatus.UNDER_SCRUTINY: {FDRStatus.VERIFIED, FDRStatus.DISCREPANCY},
    FDRStatus.DISCREPANCY: {FDRStatus.SUBMITTED},
    FDRStatus.VERIFIED: {FDRStatus.ACTIVE},
    FDRStatus.ACTIVE: {FDRStatus.EXPIRING, FDRStatus.RENEWED, FDRStatus.RELEASE_REQUESTED},
    FDRStatus.EXPIRING: {FDRStatus.MATURED, FDRStatus.RENEWED, FDRStatus.RELEASE_REQUESTED},
    FDRStatus.MATURED: {FDRStatus.RENEWED, FDRStatus.RELEASE_REQUESTED},
    FDRStatus.RELEASE_REQUESTED: {
        FDRStatus.RELEASED,
        FDRStatus.ACTIVE,
        FDRStatus.EXPIRING,
        FDRStatus.MATURED,
    },
    FDRStatus.RENEWED: set(),
    FDRStatus.RELEASED: set(),
}


class IllegalTransitionError(Exception):
    """Raised when an instrument status transition is not allowed."""

    def __init__(self, from_status: FDRStatus, to_status: FDRStatus, detail: str | None = None) -> None:
        self.from_status = from_status
        self.to_status = to_status
        self.detail = detail
        msg = f"Transition from {from_status.value} to {to_status.value} is not allowed"
        if detail:
            msg += f": {detail}"
        super().__init__(msg)


async def transition(
    session: AsyncSession,
    instrument: Instrument,
    new_status: FDRStatus,
    actor: User,
    note: str | None = None,
) -> InstrumentStatusHistory:
    """Perform a validated status transition on an instrument.

    Raises IllegalTransitionError if the transition is not in ALLOWED_TRANSITIONS,
    or if transitioning out of RELEASE_REQUESTED to a status other than where it came from.
    The caller is responsible for committing the session.
    """
    old_status = instrument.status
    allowed = ALLOWED_TRANSITIONS.get(old_status, set())

    if new_status not in allowed:
        raise IllegalTransitionError(old_status, new_status)

    # If transitioning out of RELEASE_REQUESTED back to an earlier status (rejection/withdrawal),
    # verify that it strictly restores the status it came from.
    if old_status == FDRStatus.RELEASE_REQUESTED and new_status != FDRStatus.RELEASED:
        if instrument.status_before_release_request:
            expected_status = FDRStatus(instrument.status_before_release_request)
            if new_status != expected_status:
                raise IllegalTransitionError(
                    old_status,
                    new_status,
                    f"Must restore previous status '{expected_status.value}', not '{new_status.value}'",
                )

    # When requesting release, save origin status
    if new_status == FDRStatus.RELEASE_REQUESTED:
        instrument.status_before_release_request = old_status.value

    instrument.status = new_status

    history = InstrumentStatusHistory(
        instrument_id=instrument.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=actor.id,
        note=note,
    )
    session.add(history)

    await AuditService.record(
        session,
        actor_id=actor.id,
        action="status_transition",
        entity_type="instrument",
        entity_id=instrument.id,
        payload={
            "from_status": old_status.value,
            "to_status": new_status.value,
            "note": note,
        },
    )

    return history
