"""Release conditions registry and evaluation engine."""

from __future__ import annotations

from typing import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.db.enums import ConditionResultEnum, FDRStatus, VerificationTag
from app.db.models.instrument import Instrument
from app.db.models.observation import ScrutinyObservation
from app.db.models.release import ReleaseRequest
from app.db.models.release_condition import ReleaseCondition, ReleaseConditionResult
from app.db.models.renewal import RenewalLink

# Check function signature: (session, instrument, request) -> (Result, Note)
ConditionCheckFn = Callable[
    [AsyncSession, Instrument, ReleaseRequest],
    Awaitable[tuple[ConditionResultEnum, str | None]],
]

CONDITION_REGISTRY: dict[str, ConditionCheckFn] = {}


def register_condition(code: str) -> Callable[[ConditionCheckFn], ConditionCheckFn]:
    """Decorator to register an automatic condition check function."""

    def decorator(fn: ConditionCheckFn) -> ConditionCheckFn:
        CONDITION_REGISTRY[code] = fn
        return fn

    return decorator


@register_condition("INSTRUMENT_BANK_VERIFIED")
async def check_bank_verified(
    session: AsyncSession,
    instrument: Instrument,
    request: ReleaseRequest,
) -> tuple[ConditionResultEnum, str | None]:
    """Verify that the instrument has been verified with the bank."""
    if instrument.verification_tag == VerificationTag.BANK_VERIFIED:
        return (ConditionResultEnum.PASS, "Instrument is bank-verified")
    return (
        ConditionResultEnum.FAIL,
        "Instrument verification tag is SELF_DECLARED. Bank verification is required.",
    )


@register_condition("NO_OPEN_RENEWAL")
async def check_no_open_renewal(
    session: AsyncSession,
    instrument: Instrument,
    request: ReleaseRequest,
) -> tuple[ConditionResultEnum, str | None]:
    """Verify that no unfinished renewal points at this instrument."""
    if instrument.status == FDRStatus.RENEWED:
        return (
            ConditionResultEnum.FAIL,
            "Instrument has already been renewed. Terminal status.",
        )

    # Check for renewal link where this instrument is the old instrument and replacement is pending
    stmt = (
        select(Instrument)
        .where(Instrument.replaces_instrument_id == instrument.id)
        .where(Instrument.status.in_([FDRStatus.SUBMITTED, FDRStatus.UNDER_SCRUTINY, FDRStatus.DISCREPANCY]))
    )
    res = await session.execute(stmt)
    pending_replacement = res.scalars().first()
    if pending_replacement:
        return (
            ConditionResultEnum.FAIL,
            f"An active replacement instrument ({pending_replacement.reference_number}) is currently pending scrutiny.",
        )

    return (ConditionResultEnum.PASS, "No pending replacement or unfinished renewal found")


@register_condition("NO_UNRESOLVED_DISCREPANCY")
async def check_no_unresolved_discrepancy(
    session: AsyncSession,
    instrument: Instrument,
    request: ReleaseRequest,
) -> tuple[ConditionResultEnum, str | None]:
    """Verify that no unresolved discrepancies or open discrepancy observations exist."""
    if instrument.status == FDRStatus.DISCREPANCY:
        return (
            ConditionResultEnum.FAIL,
            "Instrument is currently in DISCREPANCY status.",
        )

    stmt = select(ScrutinyObservation).where(
        ScrutinyObservation.instrument_id == instrument.id,
        ScrutinyObservation.category == "DISCREPANCY",
    )
    res = await session.execute(stmt)
    discrepancies = res.scalars().all()
    if discrepancies:
        return (
            ConditionResultEnum.FAIL,
            f"Instrument has {len(discrepancies)} discrepancy observation(s) on record.",
        )

    return (ConditionResultEnum.PASS, "No unresolved discrepancies on record")


async def evaluate_automatic_conditions(
    session: AsyncSession,
    instrument: Instrument,
    release_request: ReleaseRequest,
) -> list[ReleaseConditionResult]:
    """Run all active automatic condition checks for a release request.

    Saves or updates rows in release_condition_results.
    Returns the updated condition result objects.
    """
    stmt = select(ReleaseCondition).where(
        ReleaseCondition.is_active == True,  # noqa: E712
        ReleaseCondition.is_automatic == True,  # noqa: E712
    )
    res = await session.execute(stmt)
    auto_conditions = res.scalars().all()

    results: list[ReleaseConditionResult] = []

    for condition in auto_conditions:
        # Check if applies to this request type
        if condition.applies_to_request_type and condition.applies_to_request_type != release_request.request_type.value:
            continue

        check_fn = CONDITION_REGISTRY.get(condition.code)
        if not check_fn:
            result_val = ConditionResultEnum.NOT_APPLICABLE
            note_val = f"No check function registered for code {condition.code}"
        else:
            result_val, note_val = await check_fn(session, instrument, release_request)

        # Upsert result
        res_stmt = select(ReleaseConditionResult).where(
            ReleaseConditionResult.request_id == release_request.id,
            ReleaseConditionResult.condition_id == condition.id,
        )
        existing = (await session.execute(res_stmt)).scalars().first()

        now = clock.now()
        if existing:
            existing.result = result_val
            existing.notes = note_val
            existing.checked_at = now
            existing.is_auto = True
            existing.checked_by = None
            results.append(existing)
        else:
            new_res = ReleaseConditionResult(
                request_id=release_request.id,
                condition_id=condition.id,
                result=result_val,
                notes=note_val,
                is_auto=True,
                checked_at=now,
                checked_by=None,
            )
            session.add(new_res)
            results.append(new_res)

    await session.flush()
    return results


async def validate_mandatory_conditions(
    session: AsyncSession,
    release_request: ReleaseRequest,
) -> tuple[bool, list[str]]:
    """Check if all active mandatory conditions for this request are satisfied (PASS or NOT_APPLICABLE).

    Returns (is_satisfied: bool, list_of_failed_or_missing_condition_codes: list[str]).
    """
    # Fetch all active mandatory conditions that apply to this request
    cond_stmt = select(ReleaseCondition).where(
        ReleaseCondition.is_active == True,  # noqa: E712
        ReleaseCondition.is_mandatory == True,  # noqa: E712
    )
    all_conds = (await session.execute(cond_stmt)).scalars().all()

    # Fetch all results for this request
    res_stmt = select(ReleaseConditionResult).where(
        ReleaseConditionResult.request_id == release_request.id
    )
    all_results = {r.condition_id: r for r in (await session.execute(res_stmt)).scalars().all()}

    failed: list[str] = []
    for cond in all_conds:
        if cond.applies_to_request_type and cond.applies_to_request_type != release_request.request_type.value:
            continue

        result_row = all_results.get(cond.id)
        if not result_row:
            failed.append(f"{cond.code} (Not Evaluated)")
        elif result_row.result == ConditionResultEnum.FAIL:
            failed.append(f"{cond.code}: {result_row.notes or 'Failed'}")

    return (len(failed) == 0, failed)
