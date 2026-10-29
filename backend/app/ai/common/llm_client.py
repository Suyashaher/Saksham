"""Provider-agnostic LLM client — Gemini with NullLlmClient fallback.

If GEMINI_API_KEY is missing, the system uses NullLlmClient which forces
the rule-based fallback in NL search. No functionality is lost.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod

from pydantic import BaseModel

from app.ai.common.payload_guard import check_payload
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LlmClient(ABC):
    """Abstract LLM client interface."""

    @abstractmethod
    async def structured_output(
        self, prompt: str, schema: type[BaseModel], context: dict | None = None
    ) -> BaseModel | None:
        """Send a prompt and get a structured response matching the schema.

        Returns None on any failure (caller handles fallback).
        """
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        ...


class GeminiClient(LlmClient):
    """Google Gemini LLM client using google-genai SDK."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    @property
    def provider_name(self) -> str:
        return "gemini"

    async def structured_output(
        self, prompt: str, schema: type[BaseModel], context: dict | None = None
    ) -> BaseModel | None:
        """Call Gemini for structured output."""
        # Guard any context data before sending
        if context:
            context = check_payload(context, "gemini_structured_output")

        try:
            from google import genai

            client = genai.Client(api_key=self._api_key)

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "temperature": 0.0,
                },
            )

            if not response.text:
                logger.warning("Gemini returned empty response")
                return None

            # Parse JSON from response
            raw_json = response.text.strip()
            # Handle markdown code blocks
            if raw_json.startswith("```"):
                lines = raw_json.split("\n")
                raw_json = "\n".join(lines[1:-1])

            data = json.loads(raw_json)
            return schema.model_validate(data)

        except Exception as e:
            logger.warning("Gemini structured output failed: %s", e)
            return None


class NullLlmClient(LlmClient):
    """No-op LLM client — forces rule-based fallback."""

    @property
    def provider_name(self) -> str:
        return "none"

    async def structured_output(
        self, prompt: str, schema: type[BaseModel], context: dict | None = None
    ) -> BaseModel | None:
        return None


def get_llm_client() -> LlmClient:
    """Factory: returns GeminiClient if API key is available, else NullLlmClient."""
    settings = get_settings()
    if settings.GEMINI_API_KEY:
        logger.info("Using Gemini LLM client")
        return GeminiClient(settings.GEMINI_API_KEY)
    logger.info("No GEMINI_API_KEY — using NullLlmClient (rule-based fallback)")
    return NullLlmClient()
