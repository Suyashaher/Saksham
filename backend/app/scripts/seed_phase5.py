"""Seed script for Phase 5: release conditions, multi-state institutions, instruments in all statuses, and release requests.

Idempotent: Safe to execute multiple times.
Usage:
    python -m app.scripts.seed_phase5
"""

from __future__ import annotations

import asyncio
import datetime
from decimal import Decimal
import uuid

from sqlalchemy import select

from app.core import clock
from app.core.config import get_settings
from app.db.enums import (
    AlertChannel,
    AlertRuleType,
    ConditionResultEnum,
    FDRStatus,
    OfficerRecommendation,
    ReleaseRequestStatus,
    ReleaseRequestType,
    UserRole,
    VerificationTag,
)
from app.db.models.alert_rule import AlertRule
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.release_condition import ReleaseCondition, ReleaseConditionResult
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.user import User
from app.db.session import async_session_factory
from app.services.audit_service import AuditService
from app.services.closure_service import ClosureService
from app.services.document_service import DocumentService

SYSTEM_ACTOR_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


async def seed_phase5() -> dict[str, int]:
    today = clock.today()
    settings = get_settings()

    async with async_session_factory() as session:
        # ── 1. Seed Placeholder Release Conditions ──────────────────────────
        default_conditions = [
            {
                "code": "INSTRUMENT_BANK_VERIFIED",
                "description": "Instrument has been directly confirmed and verified with the issuing bank.",
                "is_mandatory": True,
                "is_automatic": True,
                "is_active": True,
                "applies_to_request_type": None,
            },
            {
                "code": "NO_OPEN_RENEWAL",
                "description": "No unfinalized renewal or pending replacement instrument is linked.",
                "is_mandatory": True,
                "is_automatic": True,
                "is_active": True,
                "applies_to_request_type": None,
            },
            {
                "code": "NO_UNRESOLVED_DISCREPANCY",
                "description": "Instrument has no open discrepancy observations on regulatory record.",
                "is_mandatory": True,
                "is_automatic": True,
                "is_active": True,
                "applies_to_request_type": None,
            },
            {
                "code": "APPROVAL_CYCLE_OBLIGATIONS_MET",
                "description": "Institution has fulfilled academic, land, and endowment requirements for current approval cycle.",
                "is_mandatory": True,
                "is_automatic": False,
                "is_active": True,
                "applies_to_request_type": None,
            },
            {
                "code": "NO_PENDING_COMPLIANCE_ISSUES",
                "description": "No vigilance cases, student grievance orders, or show-cause notices pending against institution.",
                "is_mandatory": True,
                "is_automatic": False,
                "is_active": True,
                "applies_to_request_type": None,
            },
            {
                "code": "REPLACEMENT_INSTRUMENT_IN_PLACE_IF_REQUIRED",
                "description": "Valid substitute FDR or bank guarantee is on deposit if security deposit is still required.",
                "is_mandatory": False,
                "is_automatic": False,
                "is_active": True,
                "applies_to_request_type": None,
            },
        ]

        conditions_map: dict[str, ReleaseCondition] = {}
        for c_data in default_conditions:
            res = await session.execute(
                select(ReleaseCondition).where(ReleaseCondition.code == c_data["code"])
            )
            cond = res.scalar_one_or_none()
            if cond is None:
                cond = ReleaseCondition(**c_data)
                session.add(cond)
                await session.flush()
            conditions_map[c_data["code"]] = cond

        # ── 2. Seed RELEASE_PENDING Alert Rules ─────────────────────────────
        release_rules = [
            {
                "name": "Release Pending Review 5 Days (Officer)",
                "rule_type": AlertRuleType.RELEASE_PENDING,
                "days": 5,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.VERIFYING_OFFICER,
                "escalate_after_days": 2,
                "is_active": True,
            },
            {
                "name": "Release Awaiting Approval 3 Days (Approver)",
                "rule_type": AlertRuleType.RELEASE_PENDING,
                "days": 3,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.APPROVING_AUTHORITY,
                "escalate_after_days": 2,
                "is_active": True,
            },
        ]
        for r_data in release_rules:
            res = await session.execute(
                select(AlertRule).where(AlertRule.name == r_data["name"])
            )
            if res.scalar_one_or_none() is None:
                session.add(AlertRule(**r_data))
                await session.flush()

        # ── 3. Seed Institutions Across Multiple States ─────────────────────
        institutions_data = [
            {
                "name": "Delhi College of Engineering & Technology",
                "aicte_id": "1-100000001",
                "state": "Delhi",
                "contact_email": "principal@dcet.edu.in",
                "contact_phone": "+911122334455",
                "approval_cycle": "2026-2027",
            },
            {
                "name": "Maharashtra Institute of Technology",
                "aicte_id": "1-100000002",
                "state": "Maharashtra",
                "contact_email": "director@mit.edu.in",
                "contact_phone": "+912022334455",
                "approval_cycle": "2026-2027",
            },
            {
                "name": "Karnataka Polytechnic Institute",
                "aicte_id": "1-100000003",
                "state": "Karnataka",
                "contact_email": "admin@kpi.edu.in",
                "contact_phone": "+918022334455",
                "approval_cycle": "2026-2027",
            },
            {
                "name": "Tamil Nadu Technical Academy",
                "aicte_id": "1-100000004",
                "state": "Tamil Nadu",
                "contact_email": "dean@tnta.edu.in",
                "contact_phone": "+914422334455",
                "approval_cycle": "2026-2027",
            },
            {
                "name": "Gujarat Institute of Advanced Studies",
                "aicte_id": "1-100000005",
                "state": "Gujarat",
                "contact_email": "contact@gias.edu.in",
                "contact_phone": "+917922334455",
                "approval_cycle": "2026-2027",
            },
            {
                "name": "Uttar Pradesh Institute of Architecture",
                "aicte_id": "1-100000006",
                "state": "Uttar Pradesh",
                "contact_email": "info@upia.edu.in",
                "contact_phone": "+915222334455",
                "approval_cycle": "2026-2027",
            },
        ]

        institutions: dict[str, Institution] = {}
        for inst_data in institutions_data:
            res = await session.execute(
                select(Institution).where(Institution.aicte_id == inst_data["aicte_id"])
            )
            inst = res.scalar_one_or_none()
            if inst is None:
                inst = Institution(**inst_data)
                session.add(inst)
                await session.flush()
            institutions[inst_data["aicte_id"]] = inst

        # Retrieve system users for actors
        officer = (
            await session.execute(
                select(User).where(User.role == UserRole.VERIFYING_OFFICER)
            )
        ).scalars().first()
        approver = (
            await session.execute(
                select(User).where(User.role == UserRole.APPROVING_AUTHORITY)
            )
        ).scalars().first()
        admin_user = (
            await session.execute(
                select(User).where(User.role == UserRole.ADMIN, User.is_active == True)  # noqa: E712
            )
        ).scalars().first()

        actor_id = officer.id if officer else SYSTEM_ACTOR_ID

        # ── 4. Seed Diverse Instruments & Release Requests ──────────────────
        demo_instruments = [
            # 1. RELEASED instrument with closure document
            {
                "ref": "FDR-DEL-2026-001",
                "inst": institutions["1-100000001"],
                "bank": "State Bank of India",
                "branch": "Connaught Place, New Delhi",
                "amount": Decimal("1500000.00"),
                "issue_date": today - datetime.timedelta(days=730),
                "maturity_date": today + datetime.timedelta(days=365),
                "status": FDRStatus.RELEASED,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": "COMPLETED",
            },
            # 2. RELEASE_REQUESTED with recommendation awaiting approval
            {
                "ref": "FDR-MAH-2026-002",
                "inst": institutions["1-100000002"],
                "bank": "Bank of Baroda",
                "branch": "Shivaji Nagar, Pune",
                "amount": Decimal("2500000.00"),
                "issue_date": today - datetime.timedelta(days=500),
                "maturity_date": today + datetime.timedelta(days=200),
                "status": FDRStatus.RELEASE_REQUESTED,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": "RECOMMENDED",
            },
            # 3. RELEASE_REQUESTED in PENDING review
            {
                "ref": "FDR-KAR-2026-003",
                "inst": institutions["1-100000003"],
                "bank": "Canara Bank",
                "branch": "MG Road, Bengaluru",
                "amount": Decimal("1000000.00"),
                "issue_date": today - datetime.timedelta(days=400),
                "maturity_date": today + datetime.timedelta(days=300),
                "status": FDRStatus.RELEASE_REQUESTED,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": "PENDING",
            },
            # 4. ACTIVE instrument (with a prior REJECTED release request)
            {
                "ref": "FDR-TN-2026-004",
                "inst": institutions["1-100000004"],
                "bank": "Indian Bank",
                "branch": "Anna Salai, Chennai",
                "amount": Decimal("3000000.00"),
                "issue_date": today - datetime.timedelta(days=365),
                "maturity_date": today + datetime.timedelta(days=365),
                "status": FDRStatus.ACTIVE,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": "REJECTED",
            },
            # 5. EXPIRING instrument
            {
                "ref": "FDR-GUJ-2026-005",
                "inst": institutions["1-100000005"],
                "bank": "HDFC Bank",
                "branch": "Ashram Road, Ahmedabad",
                "amount": Decimal("1200000.00"),
                "issue_date": today - datetime.timedelta(days=1000),
                "maturity_date": today + datetime.timedelta(days=45),
                "status": FDRStatus.EXPIRING,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": None,
            },
            # 6. MATURED & Overdue instrument
            {
                "ref": "FDR-UP-2026-006",
                "inst": institutions["1-100000006"],
                "bank": "Punjab National Bank",
                "branch": "Hazratganj, Lucknow",
                "amount": Decimal("1800000.00"),
                "issue_date": today - datetime.timedelta(days=1200),
                "maturity_date": today - datetime.timedelta(days=20),
                "status": FDRStatus.MATURED,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": None,
            },
            # 7. SUBMITTED instrument (in scrutiny queue)
            {
                "ref": "FDR-DEL-2026-007",
                "inst": institutions["1-100000001"],
                "bank": "State Bank of India",
                "branch": "South Extension, New Delhi",
                "amount": Decimal("2000000.00"),
                "issue_date": today - datetime.timedelta(days=10),
                "maturity_date": today + datetime.timedelta(days=700),
                "status": FDRStatus.SUBMITTED,
                "tag": VerificationTag.SELF_DECLARED,
                "release_flow": None,
            },
            # 8. DISCREPANCY instrument
            {
                "ref": "FDR-MAH-2026-008",
                "inst": institutions["1-100000002"],
                "bank": "ICICI Bank",
                "branch": "Andheri East, Mumbai",
                "amount": Decimal("1500000.00"),
                "issue_date": today - datetime.timedelta(days=60),
                "maturity_date": today + datetime.timedelta(days=650),
                "status": FDRStatus.DISCREPANCY,
                "tag": VerificationTag.SELF_DECLARED,
                "release_flow": None,
            },
            # 9. RENEWED instrument (terminal)
            {
                "ref": "FDR-KAR-2026-009",
                "inst": institutions["1-100000003"],
                "bank": "Canara Bank",
                "branch": "Jayanagar, Bengaluru",
                "amount": Decimal("1000000.00"),
                "issue_date": today - datetime.timedelta(days=1100),
                "maturity_date": today - datetime.timedelta(days=10),
                "status": FDRStatus.RENEWED,
                "tag": VerificationTag.BANK_VERIFIED,
                "release_flow": None,
            },
        ]

        doc_service = DocumentService(settings)

        for d_item in demo_instruments:
            res = await session.execute(
                select(Instrument).where(Instrument.reference_number == d_item["ref"])
            )
            inst = res.scalar_one_or_none()
            if inst is None:
                inst = Instrument(
                    institution_id=d_item["inst"].id,
                    reference_number=d_item["ref"],
                    issuing_bank=d_item["bank"],
                    branch=d_item["branch"],
                    amount=d_item["amount"],
                    issue_date=d_item["issue_date"],
                    maturity_date=d_item["maturity_date"],
                    status=d_item["status"],
                    verification_tag=d_item["tag"],
                    status_before_release_request="ACTIVE" if d_item["status"] in (FDRStatus.RELEASE_REQUESTED, FDRStatus.RELEASED) else None,
                )
                session.add(inst)
                await session.flush()

                # Add status history for realistic metrics
                h1 = InstrumentStatusHistory(
                    instrument_id=inst.id,
                    from_status=FDRStatus.SUBMITTED,
                    to_status=FDRStatus.ACTIVE,
                    changed_by=actor_id,
                    changed_at=inst.created_at + datetime.timedelta(days=3),
                    note="Initial verification completed",
                )
                session.add(h1)

                flow = d_item["release_flow"]
                if flow == "COMPLETED" and approver:
                    # Generate closure PDF and complete release request
                    req = ReleaseRequest(
                        instrument_id=inst.id,
                        request_type=ReleaseRequestType.RELEASE,
                        reason="Regulatory tenure completed successfully",
                        status=ReleaseRequestStatus.CLOSED,
                        requested_by=actor_id,
                        recommended_by=officer.id if officer else actor_id,
                        recommended_at=today - datetime.timedelta(days=5),
                        officer_recommendation=OfficerRecommendation.RECOMMEND,
                        decided_by=approver.id,
                        decided_at=today - datetime.timedelta(days=1),
                        decision_notes="Approved and closure letter issued",
                    )
                    session.add(req)
                    await session.flush()

                    doc, closure_ref, v_code = await ClosureService.create_closure_document(
                        session=session,
                        instrument=inst,
                        release_request=req,
                        institution=d_item["inst"],
                        approver=approver,
                        document_service=doc_service,
                    )
                    req.closure_document_id = doc.id

                elif flow == "RECOMMENDED":
                    req = ReleaseRequest(
                        instrument_id=inst.id,
                        request_type=ReleaseRequestType.RELEASE,
                        reason="Endowment period elapsed",
                        status=ReleaseRequestStatus.UNDER_REVIEW,
                        requested_by=actor_id,
                        recommended_by=officer.id if officer else actor_id,
                        recommended_at=today - datetime.timedelta(days=2),
                        officer_recommendation=OfficerRecommendation.RECOMMEND,
                        officer_notes="All documents in order and obligations satisfied.",
                    )
                    session.add(req)
                    await session.flush()

                    # Add condition results
                    for c_code, cond_obj in conditions_map.items():
                        session.add(
                            ReleaseConditionResult(
                                request_id=req.id,
                                condition_id=cond_obj.id,
                                result=ConditionResultEnum.PASS,
                                is_auto=cond_obj.is_automatic,
                                checked_by=officer.id if officer else actor_id,
                                notes="Verified satisfactory",
                            )
                        )

                elif flow == "PENDING":
                    req = ReleaseRequest(
                        instrument_id=inst.id,
                        request_type=ReleaseRequestType.REFUND,
                        reason="Refund of excess security deposit",
                        status=ReleaseRequestStatus.PENDING,
                        requested_by=actor_id,
                    )
                    session.add(req)
                    await session.flush()

                elif flow == "REJECTED":
                    req = ReleaseRequest(
                        instrument_id=inst.id,
                        request_type=ReleaseRequestType.RELEASE,
                        reason="Request prior to term completion",
                        status=ReleaseRequestStatus.REJECTED,
                        requested_by=actor_id,
                        decided_by=officer.id if officer else actor_id,
                        decided_at=today - datetime.timedelta(days=10),
                        decision_notes="Rejected: approval cycle obligations not met",
                    )
                    session.add(req)
                    await session.flush()

        await session.commit()

    return {"status": "seeded"}


if __name__ == "__main__":
    asyncio.run(seed_phase5())
