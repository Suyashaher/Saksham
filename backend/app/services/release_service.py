"""Release and refund request workflow service."""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import clock
from app.core.config import get_settings
from app.db.enums import (
    ConditionResultEnum,
    FDRStatus,
    OfficerRecommendation,
    ReleaseRequestStatus,
    UserRole,
)
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.release_condition import ReleaseCondition, ReleaseConditionResult
from app.db.models.user import User
from app.schemas.release import (
    ConditionResultResponse,
    ConditionResultUpdateItem,
    RecommendationRequest,
    RejectionRequest,
    ReleaseRequestCreate,
    ReleaseRequestDetailResponse,
    TimelineEvent,
)
from app.services.audit_service import AuditService
from app.services.closure_service import ClosureService
from app.services.document_service import DocumentService
from app.services.encryption_service import EncryptionService
from app.services.escalation import auto_resolve_alerts
from app.services.instrument_state import transition
from app.services.notification_service import create_notification
from app.services.release_conditions import (
    evaluate_automatic_conditions,
    validate_mandatory_conditions,
)


class ReleaseService:
    """Manages the full multi-level release and refund lifecycle."""

    @staticmethod
    def _get_encryption_service() -> EncryptionService:
        settings = get_settings()
        return EncryptionService(settings.DOCUMENT_ENCRYPTION_KEY)

    @classmethod
    def encrypt_beneficiary_details(cls, details: dict[str, Any] | None) -> str | None:
        """Encrypt beneficiary details into AES-256-GCM ciphertext."""
        if not details:
            return None
        enc = cls._get_encryption_service()
        raw_json = json.dumps(details)
        return enc.encrypt(raw_json)

    @classmethod
    def decrypt_beneficiary_details(cls, ciphertext: str | None) -> dict[str, Any] | None:
        """Decrypt beneficiary details from ciphertext."""
        if not ciphertext:
            return None
        enc = cls._get_encryption_service()
        try:
            raw_json = enc.decrypt(ciphertext)
            return json.loads(raw_json)
        except Exception:
            return None

    @classmethod
    def mask_beneficiary_details(cls, details: dict[str, Any] | None) -> dict[str, Any] | None:
        """Mask account number in beneficiary details for non-approvers."""
        if not details:
            return None
        masked = dict(details)
        acct = str(masked.get("account_number", ""))
        if len(acct) > 4:
            masked["account_number"] = f"******{acct[-4:]}"
        else:
            masked["account_number"] = "******"
        return masked

    @classmethod
    async def create_release_request(
        cls,
        session: AsyncSession,
        instrument_id: uuid.UUID,
        user: User,
        data: ReleaseRequestCreate,
    ) -> ReleaseRequest:
        """Submit a new release or refund request for an instrument."""
        stmt = (
            select(Instrument)
            .where(Instrument.id == instrument_id)
            .options(selectinload(Instrument.institution))
        )
        res = await session.execute(stmt)
        instrument = res.scalars().first()
        if not instrument:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

        # Scope enforcement
        if user.role == UserRole.INSTITUTION and instrument.institution_id != user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

        # Verify allowed status to request release
        allowed_from = {FDRStatus.ACTIVE, FDRStatus.EXPIRING, FDRStatus.MATURED}
        if instrument.status not in allowed_from:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot request release for instrument with status '{instrument.status.value}'",
            )

        # Check for open release request
        open_req_stmt = select(ReleaseRequest).where(
            ReleaseRequest.instrument_id == instrument_id,
            ReleaseRequest.status.in_([ReleaseRequestStatus.PENDING, ReleaseRequestStatus.UNDER_REVIEW]),
        )
        existing_open = (await session.execute(open_req_stmt)).scalars().first()
        if existing_open:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An open release request already exists for this instrument",
            )

        encrypted_beneficiary = cls.encrypt_beneficiary_details(data.beneficiary_details)

        release_req = ReleaseRequest(
            instrument_id=instrument.id,
            request_type=data.request_type,
            reason=data.reason,
            status=ReleaseRequestStatus.PENDING,
            requested_by=user.id,
            beneficiary_details=encrypted_beneficiary,
        )
        session.add(release_req)
        await session.flush()

        # Run automatic conditions
        await evaluate_automatic_conditions(session, instrument, release_req)

        # Validate mandatory automatic conditions
        is_ok, failures = await validate_mandatory_conditions(session, release_req)
        if not is_ok:
            # Rollback/abort
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Automatic condition checks failed", "failed_conditions": failures},
            )

        # Transition instrument status
        await transition(
            session=session,
            instrument=instrument,
            new_status=FDRStatus.RELEASE_REQUESTED,
            actor=user,
            note=f"{data.request_type.value} requested: {data.reason}",
        )

        # Notify verifying officers
        officers_stmt = select(User).where(User.role == UserRole.VERIFYING_OFFICER, User.is_active == True)  # noqa: E712
        officers = (await session.execute(officers_stmt)).scalars().all()
        for officer in officers:
            await create_notification(
                session=session,
                user_id=officer.id,
                title="New Release Request",
                body=f"New {data.request_type.value} request submitted for FDR {instrument.reference_number}",
            )

        # Audit entry (scrub beneficiary details from payload)
        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_request_submitted",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={
                "instrument_id": str(instrument.id),
                "request_type": data.request_type.value,
                "reason": data.reason,
                "has_beneficiary_details": bool(data.beneficiary_details),
            },
        )

        return release_req

    @classmethod
    async def withdraw_release_request(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
    ) -> ReleaseRequest:
        """Withdraw a pending release request by the institution."""
        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(selectinload(ReleaseRequest.instrument))
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        instrument = release_req.instrument
        if user.role == UserRole.INSTITUTION and instrument.institution_id != user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        if release_req.status != ReleaseRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot withdraw request in '{release_req.status.value}' status. Only PENDING requests can be withdrawn.",
            )

        now = clock.now()
        release_req.status = ReleaseRequestStatus.CLOSED
        release_req.decision_notes = "Withdrawn by institution"
        release_req.withdrawn_at = now
        release_req.decided_at = now
        release_req.decided_by = user.id

        # Revert instrument status
        prev_status = FDRStatus(instrument.status_before_release_request or FDRStatus.ACTIVE.value)
        await transition(
            session=session,
            instrument=instrument,
            new_status=prev_status,
            actor=user,
            note="Release request withdrawn by institution",
        )

        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_request_withdrawn",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={"instrument_id": str(instrument.id), "reverted_to": prev_status.value},
        )

        return release_req

    @classmethod
    async def start_review(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
    ) -> ReleaseRequest:
        """Move a request from PENDING to UNDER_REVIEW."""
        if user.role not in (UserRole.VERIFYING_OFFICER, UserRole.ADMIN):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only officers can review requests")

        req_stmt = select(ReleaseRequest).where(ReleaseRequest.id == request_id)
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        if release_req.status != ReleaseRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot start review on request in '{release_req.status.value}' status",
            )

        release_req.status = ReleaseRequestStatus.UNDER_REVIEW
        release_req.decided_by = user.id

        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_review_started",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={"status": ReleaseRequestStatus.UNDER_REVIEW.value},
        )

        return release_req

    @classmethod
    async def record_conditions(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
        results_update: list[ConditionResultUpdateItem],
    ) -> ReleaseRequest:
        """Record manual condition results and re-evaluate automatic conditions."""
        if user.role not in (UserRole.VERIFYING_OFFICER, UserRole.ADMIN):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only officers can update conditions")

        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(selectinload(ReleaseRequest.instrument))
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        if release_req.status != ReleaseRequestStatus.UNDER_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Conditions can only be updated while UNDER_REVIEW, currently '{release_req.status.value}'",
            )

        now = clock.now()

        # Update manual conditions
        for item in results_update:
            cond_stmt = select(ReleaseCondition).where(ReleaseCondition.id == item.condition_id)
            cond = (await session.execute(cond_stmt)).scalars().first()
            if not cond:
                continue

            res_stmt = select(ReleaseConditionResult).where(
                ReleaseConditionResult.request_id == release_req.id,
                ReleaseConditionResult.condition_id == cond.id,
            )
            existing = (await session.execute(res_stmt)).scalars().first()
            if existing:
                existing.result = item.result
                existing.notes = item.notes
                existing.checked_by = user.id
                existing.checked_at = now
            else:
                new_res = ReleaseConditionResult(
                    request_id=release_req.id,
                    condition_id=cond.id,
                    result=item.result,
                    notes=item.notes,
                    is_auto=False,
                    checked_by=user.id,
                    checked_at=now,
                )
                session.add(new_res)

        # Re-evaluate automatic conditions
        await evaluate_automatic_conditions(session, release_req.instrument, release_req)

        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_conditions_evaluated",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={"updated_count": len(results_update)},
        )

        return release_req

    @classmethod
    async def recommend(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
        data: RecommendationRequest,
    ) -> ReleaseRequest:
        """Submit officer recommendation for release."""
        if user.role != UserRole.VERIFYING_OFFICER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only verifying officers can recommend")

        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(selectinload(ReleaseRequest.instrument))
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        if release_req.status != ReleaseRequestStatus.UNDER_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Can only recommend requests in UNDER_REVIEW status, currently '{release_req.status.value}'",
            )

        # If recommending, all mandatory conditions must be satisfied
        if data.recommendation == OfficerRecommendation.RECOMMEND:
            is_ok, failures = await validate_mandatory_conditions(session, release_req)
            if not is_ok:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"message": "Cannot recommend release with unsatisfied mandatory conditions", "failures": failures},
                )

        now = clock.now()
        release_req.recommended_by = user.id
        release_req.recommended_at = now
        release_req.officer_recommendation = data.recommendation
        release_req.officer_notes = data.notes

        # Notify Approving Authority users
        approvers_stmt = select(User).where(User.role == UserRole.APPROVING_AUTHORITY, User.is_active == True)  # noqa: E712
        approvers = (await session.execute(approvers_stmt)).scalars().all()
        for approver in approvers:
            await create_notification(
                session=session,
                user_id=approver.id,
                title="Release Request Ready for Approval",
                body=f"Officer recommended '{data.recommendation.value}' for FDR {release_req.instrument.reference_number}",
            )

        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_recommended",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={
                "recommendation": data.recommendation.value,
                "notes": data.notes,
            },
        )

        return release_req

    @classmethod
    async def approve(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
        document_service: DocumentService,
    ) -> ReleaseRequest:
        """Approve a release request, generating the closure certificate atomically."""
        if user.role != UserRole.APPROVING_AUTHORITY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only APPROVING_AUTHORITY can approve release requests. ADMIN is barred.",
            )

        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(
                selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution)
            )
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        # Segregation of duties: approver cannot be the recommending officer
        if release_req.recommended_by == user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Segregation of duties violation: Approving authority cannot be the recommending officer",
            )

        if release_req.status != ReleaseRequestStatus.UNDER_REVIEW or not release_req.recommended_at:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request must be UNDER_REVIEW and recommended by an officer before approval",
            )

        # Validate all mandatory conditions
        is_ok, failures = await validate_mandatory_conditions(session, release_req)
        if not is_ok:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Cannot approve: mandatory conditions unsatisfied", "failures": failures},
            )

        now = clock.now()
        instrument = release_req.instrument
        institution = instrument.institution

        # Step 1: Generate closure PDF and upload via DocumentService (in same transaction)
        doc, closure_ref, verification_code = await ClosureService.create_closure_document(
            session=session,
            instrument=instrument,
            release_request=release_req,
            institution=institution,
            approver=user,
            document_service=document_service,
        )

        # Step 2: Attach closure doc and update request status
        release_req.closure_document_id = doc.id
        release_req.status = ReleaseRequestStatus.CLOSED
        release_req.decided_by = user.id
        release_req.decided_at = now
        release_req.decision_notes = f"Approved and closure certificate {closure_ref} issued"

        # Step 3: Transition instrument to RELEASED
        await transition(
            session=session,
            instrument=instrument,
            new_status=FDRStatus.RELEASED,
            actor=user,
            note=f"Release approved by {user.name or user.email}. Certificate: {closure_ref}",
        )

        # Step 4: Auto-resolve all open alerts
        await auto_resolve_alerts(session, instrument.id, "released")

        # Step 5: Notify institution users
        inst_users_stmt = select(User).where(User.institution_id == institution.id, User.is_active == True)  # noqa: E712
        inst_users = (await session.execute(inst_users_stmt)).scalars().all()
        for inst_user in inst_users:
            await create_notification(
                session=session,
                user_id=inst_user.id,
                title="Security Deposit Released",
                body=f"Your security deposit {instrument.reference_number} has been officially RELEASED. Certificate {closure_ref} is available for download.",
            )

        # Step 6: Audit
        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_approved",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={
                "instrument_id": str(instrument.id),
                "closure_reference": closure_ref,
                "verification_code": verification_code,
                "closure_document_id": str(doc.id),
            },
        )

        return release_req

    @classmethod
    async def reject(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
        data: RejectionRequest,
    ) -> ReleaseRequest:
        """Reject a release request (by officer before recommendation, or approver anytime)."""
        if user.role not in (UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only VERIFYING_OFFICER or APPROVING_AUTHORITY can reject release requests. ADMIN is barred.",
            )

        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(
                selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution)
            )
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        if release_req.status not in (ReleaseRequestStatus.PENDING, ReleaseRequestStatus.UNDER_REVIEW):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot reject request in '{release_req.status.value}' status",
            )

        # If officer is rejecting after recommendation has been submitted, disallow (must be rejected by approver)
        if user.role == UserRole.VERIFYING_OFFICER and release_req.recommended_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recommendation has already been submitted to Approving Authority; officer cannot reject at this stage.",
            )

        now = clock.now()
        instrument = release_req.instrument

        release_req.status = ReleaseRequestStatus.REJECTED
        release_req.decided_by = user.id
        release_req.decided_at = now
        release_req.decision_notes = data.reason

        # Revert instrument to status_before_release_request
        prev_status = FDRStatus(instrument.status_before_release_request or FDRStatus.ACTIVE.value)
        await transition(
            session=session,
            instrument=instrument,
            new_status=prev_status,
            actor=user,
            note=f"Release rejected: {data.reason}",
        )

        # Notify institution
        inst_users_stmt = select(User).where(User.institution_id == instrument.institution_id, User.is_active == True)  # noqa: E712
        inst_users = (await session.execute(inst_users_stmt)).scalars().all()
        for inst_user in inst_users:
            await create_notification(
                session=session,
                user_id=inst_user.id,
                title="Release Request Rejected",
                body=f"Your release request for FDR {instrument.reference_number} was rejected: {data.reason}",
            )

        await AuditService.record(
            session=session,
            actor_id=user.id,
            action="release_rejected",
            entity_type="release_request",
            entity_id=release_req.id,
            payload={
                "instrument_id": str(instrument.id),
                "reason": data.reason,
                "reverted_to": prev_status.value,
            },
        )

        return release_req

    @classmethod
    async def get_request_detail(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        user: User,
    ) -> ReleaseRequestDetailResponse:
        """Fetch complete detail of a release request with condition results, timeline, and masked beneficiary."""
        req_stmt = (
            select(ReleaseRequest)
            .where(ReleaseRequest.id == request_id)
            .options(
                selectinload(ReleaseRequest.instrument).selectinload(Instrument.institution),
                selectinload(ReleaseRequest.condition_results).selectinload(ReleaseConditionResult.condition),
            )
        )
        release_req = (await session.execute(req_stmt)).scalars().first()
        if not release_req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        instrument = release_req.instrument
        if user.role == UserRole.INSTITUTION and instrument.institution_id != user.institution_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Release request not found")

        # Beneficiary details handling
        raw_beneficiary = cls.decrypt_beneficiary_details(release_req.beneficiary_details)
        if user.role == UserRole.APPROVING_AUTHORITY:
            beneficiary_view = raw_beneficiary
        else:
            beneficiary_view = cls.mask_beneficiary_details(raw_beneficiary)

        # Condition results mapping
        cond_items: list[ConditionResultResponse] = []
        for cr in release_req.condition_results:
            cond_items.append(
                ConditionResultResponse(
                    id=cr.id,
                    condition_id=cr.condition_id,
                    code=cr.condition.code,
                    description=cr.condition.description,
                    is_mandatory=cr.condition.is_mandatory,
                    is_auto=cr.is_auto,
                    result=cr.result,
                    checked_at=cr.checked_at,
                    checked_by_id=cr.checked_by,
                    notes=cr.notes,
                )
            )

        # Build timeline
        timeline: list[TimelineEvent] = [
            TimelineEvent(
                timestamp=release_req.created_at,
                event="SUBMITTED",
                notes=release_req.reason,
            )
        ]
        if release_req.recommended_at:
            timeline.append(
                TimelineEvent(
                    timestamp=release_req.recommended_at,
                    event=f"RECOMMENDED ({release_req.officer_recommendation.value if release_req.officer_recommendation else ''})",
                    notes=release_req.officer_notes,
                )
            )
        if release_req.decided_at:
            timeline.append(
                TimelineEvent(
                    timestamp=release_req.decided_at,
                    event=release_req.status.value,
                    notes=release_req.decision_notes,
                )
            )

        return ReleaseRequestDetailResponse(
            id=release_req.id,
            instrument_id=release_req.instrument_id,
            request_type=release_req.request_type,
            status=release_req.status,
            reason=release_req.reason,
            requested_by=release_req.requested_by,
            decided_by=release_req.decided_by,
            recommended_by=release_req.recommended_by,
            recommended_at=release_req.recommended_at,
            officer_recommendation=release_req.officer_recommendation,
            withdrawn_at=release_req.withdrawn_at,
            closure_document_id=release_req.closure_document_id,
            created_at=release_req.created_at,
            decided_at=release_req.decided_at,
            officer_notes=release_req.officer_notes,
            decision_notes=release_req.decision_notes,
            beneficiary_details=beneficiary_view,
            condition_results=cond_items,
            timeline=timeline,
        )
