"""LLM-based NL query parser — converts natural language to InstrumentFilter.

Uses the system prompt from design doc D.3 with few-shot examples from D.4.
Falls back to rule-based parser on any failure.
"""

from __future__ import annotations

import logging

from app.ai.common.llm_client import LlmClient
from app.ai.nlsearch.rule_parser import parse_nl_query
from app.core import clock
from app.services.instrument_filters import InstrumentFilter

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a search query parser for the AICTE FDR Management Portal.
Convert the user's natural-language query into a JSON object matching
the InstrumentFilter schema.

SCHEMA:
{{
  "statuses": ["SUBMITTED"|"UNDER_SCRUTINY"|"VERIFIED"|"DISCREPANCY"|"ACTIVE"|"EXPIRING"|"MATURED"|"RENEWED"|"RELEASE_REQUESTED"|"RELEASED"],
  "instrument_types": ["FDR"|"BANK_GUARANTEE"],
  "missing_doc_types": ["FDR_SCAN"|"BANK_GUARANTEE_DOCUMENT"|"DEPOSIT_CONFIRMATION"|"BANK_LETTER"|"RENEWAL_CERTIFICATE"],
  "verification_tag": "SELF_DECLARED"|"BANK_VERIFIED",
  "banks": ["bank names"],
  "states": ["Indian state names"],
  "amount_min": number,
  "amount_max": number,
  "maturity_from": "YYYY-MM-DD",
  "maturity_to": "YYYY-MM-DD",
  "issue_from": "YYYY-MM-DD",
  "issue_to": "YYYY-MM-DD",
  "has_missing_documents": boolean,
  "has_open_alerts": boolean,
  "escalation_level_min": integer,
  "text": "free text search",
  "sort_by": "created_at"|"amount"|"maturity_date",
  "sort_dir": "asc"|"desc"
}}

RULES:
1. Only include fields that the query mentions. Omit fields with no info.
2. Today's date is {today}. Convert relative dates (e.g., "next 30 days") to absolute ISO dates.
3. Convert Indian amount notation: "5 lakh" = 500000, "1 crore" = 10000000.
4. Normalize bank abbreviations: SBI = "State Bank of India", PNB = "Punjab National Bank", etc.
5. DO NOT include institution_id or any scope fields — scoping is applied server-side.
6. Return ONLY valid JSON. No explanation.

EXAMPLES:
// "SBI FDRs above 5 lakh"
{{"banks": ["State Bank of India"], "amount_min": 500000}}

// "Bank guarantees from HDFC above 10 lakh"
{{"instrument_types": ["BANK_GUARANTEE"], "banks": ["HDFC Bank"], "amount_min": 1000000}}

// "BGs missing bank confirmation letter"
{{"instrument_types": ["BANK_GUARANTEE"], "missing_doc_types": ["BANK_LETTER"]}}

// "flagged instruments from Maharashtra"
{{"statuses": ["DISCREPANCY"], "states": ["Maharashtra"]}}

// "instruments maturing in next 30 days"
{{"maturity_from": "{today}", "maturity_to": "{today_plus_30}"}}

// "show all released FDRs sorted by highest amount"
{{"statuses": ["RELEASED"], "sort_by": "amount", "sort_dir": "desc"}}

// "HDFC ke pending review waale FDR" (Hinglish)
{{"banks": ["HDFC Bank"], "statuses": ["UNDER_SCRUTINY"]}}
"""


async def parse_with_llm(
    query: str, llm_client: LlmClient
) -> dict | None:
    """Try to parse a query using the LLM. Returns dict or None on failure."""
    today = clock.today()
    today_plus_30 = (today + __import__("datetime").timedelta(days=30))

    prompt = SYSTEM_PROMPT.format(
        today=today.isoformat(),
        today_plus_30=today_plus_30.isoformat(),
    )
    prompt += f"\n\nUSER QUERY: {query}\n\nJSON:"

    try:
        result = await llm_client.structured_output(
            prompt, InstrumentFilter
        )
        if result is not None:
            return result.model_dump(exclude_none=True)
    except Exception as e:
        logger.warning("LLM NL parsing failed: %s", e)

    return None
