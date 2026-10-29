"""Seed script for Phase 4: default AlertRules and demo timeline Instruments.

Idempotent: Safe to execute multiple times.
Usage:
    python -m app.scripts.seed_phase4
"""

from __future__ import annotations

import asyncio
import datetime
from decimal import Decimal

from sqlalchemy import select

from app.core import clock
from app.db.enums import AlertChannel, AlertRuleType, FDRStatus, UserRole, VerificationTag
from app.db.models.alert_rule import AlertRule
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.session import async_session_factory
from app.scripts.seed_users import SYSTEM_USER_ID
from app.services.audit_service import AuditService


async def seed_phase4() -> dict[str, int]:
    today_date = clock.today()
    created_rules = 0
    skipped_rules = 0
    created_insts = 0
    skipped_insts = 0

    async with async_session_factory() as session:
        # ── 1. Default Alert Rules ──────────────────────────────────────────
        default_rules = [
            {
                "name": "Maturity Reminder 90 Days (Institution)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 90,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Maturity Reminder 60 Days (Institution)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 60,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Maturity Reminder 30 Days (Institution)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 30,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Maturity Reminder 7 Days (Institution)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 7,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.SMS.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Maturity Notice 90 Days (Officer)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 90,
                "channels": [AlertChannel.EMAIL.value],
                "recipient_role": UserRole.VERIFYING_OFFICER,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Maturity Notice 30 Days (Officer)",
                "rule_type": AlertRuleType.MATURITY_REMINDER,
                "days": 30,
                "channels": [AlertChannel.EMAIL.value],
                "recipient_role": UserRole.VERIFYING_OFFICER,
                "escalate_after_days": None,
                "is_active": True,
            },
            {
                "name": "Overdue Matured Instrument (Immediate)",
                "rule_type": AlertRuleType.OVERDUE_MATURED,
                "days": 0,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.SMS.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": 7,
                "is_active": True,
            },
            {
                "name": "Stale Scrutiny / Verification (30 Days)",
                "rule_type": AlertRuleType.STALE_VERIFICATION,
                "days": 30,
                "channels": [AlertChannel.EMAIL.value],
                "recipient_role": UserRole.VERIFYING_OFFICER,
                "escalate_after_days": 14,
                "is_active": True,
            },
            {
                "name": "Unresolved Discrepancy (14 Days)",
                "rule_type": AlertRuleType.DISCREPANCY_UNRESOLVED,
                "days": 14,
                "channels": [AlertChannel.EMAIL.value, AlertChannel.IN_APP.value],
                "recipient_role": UserRole.INSTITUTION,
                "escalate_after_days": 7,
                "is_active": True,
            },
        ]

        for r_def in default_rules:
            existing = await session.execute(
                select(AlertRule).where(AlertRule.name == r_def["name"])
            )
            rule = existing.scalar_one_or_none()
            if rule is None:
                rule = AlertRule(**r_def)
                session.add(rule)
                await session.flush()
                await AuditService.record(
                    session,
                    actor_id=SYSTEM_USER_ID,
                    action="alert_rule_created",
                    entity_type="alert_rule",
                    entity_id=rule.id,
                    payload={"name": rule.name, "seed": True},
                )
                created_rules += 1
            else:
                skipped_rules += 1

        # ── 2. Demo Timeline Instruments (for DTU) ──────────────────────────
        inst_res = await session.execute(
            select(Institution).where(Institution.aicte_id == "1-DTU-DELHI")
        )
        dtu = inst_res.scalar_one_or_none()
        if dtu:
            timeline_specs = [
                {
                    "reference_number": "DEMO-100D",
                    "days_offset": 100,
                    "status": FDRStatus.ACTIVE,
                    "validity_status": "VALID",
                },
                {
                    "reference_number": "DEMO-85D",
                    "days_offset": 85,
                    "status": FDRStatus.ACTIVE,
                    "validity_status": "VALID",
                },
                {
                    "reference_number": "DEMO-45D",
                    "days_offset": 45,
                    "status": FDRStatus.EXPIRING,
                    "validity_status": "EXPIRING",
                },
                {
                    "reference_number": "DEMO-20D",
                    "days_offset": 20,
                    "status": FDRStatus.EXPIRING,
                    "validity_status": "EXPIRING",
                },
                {
                    "reference_number": "DEMO-5D",
                    "days_offset": 5,
                    "status": FDRStatus.EXPIRING,
                    "validity_status": "EXPIRING",
                },
                {
                    "reference_number": "DEMO-OVR2",
                    "days_offset": -2,
                    "status": FDRStatus.MATURED,
                    "validity_status": "EXPIRED",
                },
                {
                    "reference_number": "DEMO-OVR10",
                    "days_offset": -10,
                    "status": FDRStatus.MATURED,
                    "validity_status": "EXPIRED",
                },
                {
                    "reference_number": "DEMO-BG-ACTIVE",
                    "days_offset": 120,
                    "status": FDRStatus.ACTIVE,
                    "validity_status": "VALID",
                    "instrument_type": "BANK_GUARANTEE",
                    "claim_offset": 180,
                },
                {
                    "reference_number": "DEMO-BG-EXPIRING",
                    "days_offset": 25,
                    "status": FDRStatus.EXPIRING,
                    "validity_status": "EXPIRING",
                    "instrument_type": "BANK_GUARANTEE",
                    "claim_offset": 85,
                },
            ]

            for spec in timeline_specs:
                existing_inst = await session.execute(
                    select(Instrument).where(Instrument.reference_number == spec["reference_number"])
                )
                if existing_inst.scalar_one_or_none() is None:
                    maturity = today_date + datetime.timedelta(days=spec["days_offset"])
                    issue = maturity - datetime.timedelta(days=365)
                    claim_exp = (
                        today_date + datetime.timedelta(days=spec["claim_offset"])
                        if "claim_offset" in spec
                        else None
                    )
                    instrument = Instrument(
                        institution_id=dtu.id,
                        reference_number=spec["reference_number"],
                        issuing_bank="State Bank of India",
                        branch="Main Delhi Branch",
                        amount=Decimal("5000000.00"),
                        required_amount=Decimal("5000000.00"),
                        issue_date=issue,
                        maturity_date=maturity,
                        status=spec["status"],
                        validity_status=spec["validity_status"],
                        verification_tag=VerificationTag.BANK_VERIFIED,
                        instrument_type=spec.get("instrument_type", "FDR"),
                        claim_expiry_date=claim_exp,
                        beneficiary_name="AICTE",
                    )
                    session.add(instrument)
                    await session.flush()
                    await AuditService.record(
                        session,
                        actor_id=SYSTEM_USER_ID,
                        action="instrument_created",
                        entity_type="instrument",
                        entity_id=instrument.id,
                        payload={"reference_number": instrument.reference_number, "seed": True},
                    )
                    created_insts += 1
                else:
                    skipped_insts += 1

        await session.commit()

    print("\n" + "=" * 65)
    print("AICTE FDR PORTAL - PHASE 4 SEED SUMMARY")
    print("=" * 65)
    print(f"Alert Rules: {created_rules} created, {skipped_rules} skipped.")
    print(f"Timeline Instruments: {created_insts} created, {skipped_insts} skipped.")
    print("=" * 65 + "\n")

    return {
        "created_rules": created_rules,
        "skipped_rules": skipped_rules,
        "created_instruments": created_insts,
        "skipped_instruments": skipped_insts,
    }


def main():
    asyncio.run(seed_phase4())


if __name__ == "__main__":
    main()
