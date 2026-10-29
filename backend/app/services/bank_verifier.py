"""Bank verification interface and mock implementation."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.mock_bank import MockBankRegistry


@dataclass
class BankVerificationResult:
    """Result of a bank verification lookup."""

    found: bool
    matches: bool
    mismatches: dict = field(default_factory=dict)
    raw_response: dict = field(default_factory=dict)


class BankVerifier(ABC):
    """Abstract interface for bank verification backends."""

    @abstractmethod
    async def verify(
        self,
        session: AsyncSession,
        reference_number: str,
        issuing_bank: str,
        amount: Decimal,
        issue_date: date,
        maturity_date: date,
    ) -> BankVerificationResult:
        """Verify instrument details against the bank's records."""
        ...


class MockBankVerifier(BankVerifier):
    """Development-only verifier backed by the mock_bank_registry table."""

    async def verify(
        self,
        session: AsyncSession,
        reference_number: str,
        issuing_bank: str,
        amount: Decimal,
        issue_date: date,
        maturity_date: date,
    ) -> BankVerificationResult:
        result = await session.execute(
            select(MockBankRegistry).where(
                MockBankRegistry.reference_number == reference_number
            )
        )
        row = result.scalar_one_or_none()

        if row is None:
            return BankVerificationResult(
                found=False, matches=False, mismatches={}, raw_response={}
            )

        mismatches: dict[str, dict] = {}

        if str(row.issuing_bank) != str(issuing_bank):
            mismatches["issuing_bank"] = {
                "expected": row.issuing_bank,
                "actual": issuing_bank,
            }
        if row.amount != amount:
            mismatches["amount"] = {
                "expected": str(row.amount),
                "actual": str(amount),
            }
        if row.issue_date != issue_date:
            mismatches["issue_date"] = {
                "expected": row.issue_date.isoformat(),
                "actual": issue_date.isoformat(),
            }
        if row.maturity_date != maturity_date:
            mismatches["maturity_date"] = {
                "expected": row.maturity_date.isoformat(),
                "actual": maturity_date.isoformat(),
            }

        raw_response = {
            "reference_number": row.reference_number,
            "issuing_bank": row.issuing_bank,
            "branch": row.branch,
            "amount": str(row.amount),
            "issue_date": row.issue_date.isoformat(),
            "maturity_date": row.maturity_date.isoformat(),
            "holder_name": row.holder_name,
            "is_valid": row.is_valid,
        }

        return BankVerificationResult(
            found=True,
            matches=(len(mismatches) == 0),
            mismatches=mismatches,
            raw_response=raw_response,
        )


def get_bank_verifier(settings: Settings) -> BankVerifier:
    """Factory — returns the appropriate BankVerifier implementation.

    Currently only "mock" is supported; extensible for real bank APIs later.
    """
    return MockBankVerifier()
