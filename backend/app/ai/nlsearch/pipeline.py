"""NL Search pipeline — orchestrates LLM parser, rule-based fallback, and query execution.

SECURITY: NL search can only READ data. It cannot modify instruments or
bypass row-level security. build_query() enforces scope_to_institution.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.common.llm_client import LlmClient, get_llm_client
from app.ai.nlsearch.chips import generate_chips
from app.ai.nlsearch.llm_parser import parse_with_llm
from app.ai.nlsearch.rule_parser import parse_nl_query
from app.db.models.ai_models import NLSearchLog
from app.db.models.user import User
from app.services.instrument_filters import InstrumentFilter, build_query

logger = logging.getLogger(__name__)


@dataclass
class NLSearchResult:
    """Result of a natural-language search."""

    parsed_filter: dict
    chips: list[str]
    method: str  # "llm", "rule_based", "text_search"
    results: list
    total: int
    duration_ms: int


async def parse_and_search(
    query: str,
    user: User,
    session: AsyncSession,
    llm_client: LlmClient | None = None,
    page: int = 1,
    page_size: int = 20,
) -> NLSearchResult:
    """Full NL search pipeline: parse query → build SQL → execute → return results.

    1. Try LLM parsing (if available)
    2. Validate against InstrumentFilter schema
    3. On failure → fall back to rule-based parser
    4. If nothing parsed → text search
    5. Execute via build_query() (which always applies scope_to_institution)
    """
    start = time.monotonic()

    if llm_client is None:
        llm_client = get_llm_client()

    parsed_filter: dict | None = None
    method = "rule_based"

    # Step 1: Try LLM
    if llm_client.provider_name != "none":
        parsed_filter = await parse_with_llm(query, llm_client)
        if parsed_filter:
            # Validate against schema
            try:
                validated = InstrumentFilter.model_validate(parsed_filter)
                parsed_filter = validated.model_dump(exclude_none=True)
                method = "llm"
            except Exception as e:
                logger.warning("LLM output failed validation: %s — retrying", e)
                # Retry once
                parsed_filter = await parse_with_llm(query, llm_client)
                if parsed_filter:
                    try:
                        validated = InstrumentFilter.model_validate(parsed_filter)
                        parsed_filter = validated.model_dump(exclude_none=True)
                        method = "llm"
                    except Exception:
                        parsed_filter = None

    # Step 2: Fall back to rule-based
    if parsed_filter is None:
        parsed_filter = parse_nl_query(query)
        method = "rule_based"

    # Step 3: If still empty, use text search
    if not parsed_filter:
        parsed_filter = {"text": query}
        method = "text_search"

    # Add pagination
    parsed_filter["page"] = page
    parsed_filter["page_size"] = page_size

    # Generate chips
    chips = generate_chips(parsed_filter)

    # Step 4: Build and execute query via existing infrastructure
    try:
        filter_obj = InstrumentFilter.model_validate(parsed_filter)
        stmt, count_stmt = build_query(filter_obj, user)
        result = await session.execute(stmt)
        items = list(result.scalars().all())
        count_result = await session.execute(count_stmt)
        total = count_result.scalar_one()
    except Exception as e:
        logger.error("NL search query execution failed: %s", e)
        items = []
        total = 0

    duration_ms = int((time.monotonic() - start) * 1000)

    # Log search (redacted — no PII)
    log_entry = NLSearchLog(
        user_id=user.id,
        query_redacted=_redact_query(query),
        parsed_filter=parsed_filter,
        method=method,
        result_count=total,
        duration_ms=duration_ms,
    )
    session.add(log_entry)

    return NLSearchResult(
        parsed_filter=parsed_filter,
        chips=chips,
        method=method,
        results=items,
        total=total,
        duration_ms=duration_ms,
    )


def _redact_query(query: str) -> str:
    """Redact potentially sensitive data from a query for logging."""
    import re
    # Redact anything that looks like a phone, email, or long number
    redacted = re.sub(r"\b\d{10,}\b", "[REDACTED_NUMBER]", query)
    redacted = re.sub(r"\S+@\S+\.\S+", "[REDACTED_EMAIL]", redacted)
    return redacted
