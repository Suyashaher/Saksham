"""NL Search API router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_session, require_roles
from app.db.enums import UserRole
from app.ai.nlsearch.pipeline import parse_and_search
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/v1", tags=["AI NL Search"])


class NLSearchRequest(BaseModel):
    query: str
    page: int = 1
    page_size: int = 20


class NLSearchResultItem(BaseModel):
    id: str
    reference_number: str
    issuing_bank: str
    amount: float
    status: str
    maturity_date: str | None


class NLSearchResponse(BaseModel):
    parsed_filter: dict
    chips: list[str]
    method: str
    results: list[NLSearchResultItem]
    total: int
    page: int
    duration_ms: int


@router.post("/instruments/nl-search", response_model=NLSearchResponse)
async def nl_search(
    body: NLSearchRequest,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles(
        UserRole.VERIFYING_OFFICER, UserRole.APPROVING_AUTHORITY, UserRole.ADMIN
    )),
):
    """Search instruments using natural language.

    Parses the query into structured filters, executes via build_query()
    (which always applies scope_to_institution), and returns results
    with human-readable filter chips.
    """
    settings = get_settings()
    if not settings.AI_ENABLED or not settings.AI_NLSEARCH_ENABLED:
        raise HTTPException(status_code=503, detail="NL Search feature is disabled")

    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    search_result = await parse_and_search(
        query=body.query,
        user=user,
        session=session,
        page=body.page,
        page_size=body.page_size,
    )

    # Serialize instrument results
    result_items = []
    for inst in search_result.results:
        result_items.append(NLSearchResultItem(
            id=str(inst.id),
            reference_number=inst.reference_number,
            issuing_bank=inst.issuing_bank,
            amount=float(inst.amount),
            status=inst.status.value if hasattr(inst.status, "value") else str(inst.status),
            maturity_date=inst.maturity_date.isoformat() if inst.maturity_date else None,
        ))

    await AuditService.record(
        session,
        actor_id=user.id,
        action="nl_search",
        entity_type="search",
        entity_id=user.id,
        payload={
            "method": search_result.method,
            "result_count": search_result.total,
            "duration_ms": search_result.duration_ms,
        },
    )

    await session.commit()

    return NLSearchResponse(
        parsed_filter=search_result.parsed_filter,
        chips=search_result.chips,
        method=search_result.method,
        results=result_items,
        total=search_result.total,
        page=body.page,
        duration_ms=search_result.duration_ms,
    )
