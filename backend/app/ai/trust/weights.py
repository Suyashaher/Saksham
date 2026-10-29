"""DB-backed versioned weight store for trust score factors."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.ai_models import TrustScoreWeight

logger = logging.getLogger(__name__)

# Default weights — must match migration seed data
DEFAULT_WEIGHTS: dict[str, float] = {
    "document_completeness": 20,
    "ocr_match": 15,
    "bank_verification": 20,
    "amount_reasonableness": 10,
    "date_consistency": 10,
    "alert_count": 10,
    "cross_doc_consistency": 5,
    "renewal_chain_integrity": 5,
    "response_timeliness": 3,
    "bank_reputation": 2,
}


class WeightStore:
    """Loads and manages versioned trust score weights from the DB."""

    @staticmethod
    async def get_active_weights(session: AsyncSession) -> tuple[dict[str, float], int]:
        """Get the currently active weight set.

        Returns (weights_dict, version_number). Falls back to defaults
        if no active weights are in the DB.
        """
        result = await session.execute(
            select(TrustScoreWeight).where(TrustScoreWeight.is_active == True)
        )
        rows = list(result.scalars().all())

        if not rows:
            logger.warning("No active trust score weights in DB, using defaults")
            return DEFAULT_WEIGHTS.copy(), 0

        weights: dict[str, float] = {}
        version = rows[0].version  # all active rows share the same version
        for row in rows:
            weights[row.factor_name] = row.weight
            version = row.version

        return weights, version

    @staticmethod
    async def create_new_version(
        session: AsyncSession,
        weights: dict[str, float],
        approved_by: uuid.UUID | None = None,
    ) -> int:
        """Create a new weight version.

        Deactivates the current active version and inserts new rows.
        Returns the new version number.
        """
        # Get current max version
        result = await session.execute(
            select(TrustScoreWeight.version)
            .order_by(TrustScoreWeight.version.desc())
            .limit(1)
        )
        current_max = result.scalar_one_or_none() or 0
        new_version = current_max + 1

        now = datetime.now(timezone.utc)

        # Deactivate current active weights
        await session.execute(
            update(TrustScoreWeight)
            .where(TrustScoreWeight.is_active == True)
            .values(is_active=False, effective_to=now)
        )

        # Insert new weights
        for factor_name, weight in weights.items():
            row = TrustScoreWeight(
                version=new_version,
                factor_name=factor_name,
                weight=weight,
                description=f"Updated in version {new_version}",
                is_active=True,
                approved_by=approved_by,
                effective_from=now,
            )
            session.add(row)

        return new_version

    @staticmethod
    async def list_versions(session: AsyncSession) -> list[dict]:
        """List all weight versions with their factors."""
        result = await session.execute(
            select(TrustScoreWeight).order_by(
                TrustScoreWeight.version.desc(),
                TrustScoreWeight.factor_name,
            )
        )
        rows = list(result.scalars().all())

        versions: dict[int, dict] = {}
        for row in rows:
            if row.version not in versions:
                versions[row.version] = {
                    "version": row.version,
                    "is_active": row.is_active,
                    "effective_from": row.effective_from.isoformat() if row.effective_from else None,
                    "effective_to": row.effective_to.isoformat() if row.effective_to else None,
                    "factors": {},
                }
            versions[row.version]["factors"][row.factor_name] = row.weight

        return sorted(versions.values(), key=lambda v: v["version"], reverse=True)
