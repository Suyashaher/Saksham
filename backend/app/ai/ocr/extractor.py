"""OCR extractor — implements the OcrExtractor ABC from validation.py.

Two modes:
  1. Preview: extract fields from raw file bytes, return JSON (nothing stored)
  2. Attach: extract + compare_with_declared → WARNING validation flags

SECURITY:
  - All processing in memory, never log extracted text
  - Never send documents to external services
  - OCR output is untrusted input — officer must confirm
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from app.ai.ocr.engine import OcrEngine, NullEngine, get_ocr_engine
from app.ai.ocr.preprocessor import file_to_images, preprocess_image
from app.ai.ocr.profiles import (
    ExtractionProfile,
    FieldDef,
    get_profile,
)
from app.services.validation import OcrExtractor, compare_with_declared, ValidationIssue

logger = logging.getLogger(__name__)


@dataclass
class FieldResult:
    """Result of extracting a single field."""

    name: str
    value: Any
    confidence: float  # 0.0 - 1.0
    raw_match: str | None = None


@dataclass
class ExtractionResult:
    """Full extraction result from a document."""

    fields: dict[str, Any]
    field_results: list[FieldResult]
    overall_confidence: float
    page_count: int
    duration_ms: int
    engine: str
    engine_version: str
    doc_type: str
    mismatches: list[ValidationIssue] = field(default_factory=list)


class TesseractOcrExtractor(OcrExtractor):
    """Production OCR extractor using Tesseract + field parsers.

    Implements the OcrExtractor ABC so it plugs into the existing
    validation pipeline via compare_with_declared().
    """

    def __init__(
        self,
        engine: OcrEngine | None = None,
        languages: str = "eng+hin",
    ) -> None:
        self._engine = engine or get_ocr_engine()
        self._languages = languages

    @property
    def is_available(self) -> bool:
        return self._engine.is_available()

    async def extract(self, file_bytes: bytes, content_type: str) -> dict:
        """Extract instrument fields from a document (OcrExtractor ABC).

        Returns a dict of field_name → parsed_value.
        Uses FDR_SCAN profile by default (the ABC doesn't pass doc_type).
        """
        result = self.extract_with_profile(
            file_bytes, content_type, doc_type="FDR_SCAN"
        )
        return result.fields

    def extract_with_profile(
        self,
        file_bytes: bytes,
        content_type: str,
        doc_type: str = "FDR_SCAN",
    ) -> ExtractionResult:
        """Extract fields using the appropriate document-type profile.

        This is the main method — provides full results with confidence.
        """
        start = time.monotonic()

        profile = get_profile(doc_type)
        if profile is None:
            profile = get_profile("OTHER")

        # Convert file to images
        images = file_to_images(file_bytes, content_type)
        if not images:
            return ExtractionResult(
                fields={},
                field_results=[],
                overall_confidence=0.0,
                page_count=0,
                duration_ms=int((time.monotonic() - start) * 1000),
                engine=self._engine.engine_name,
                engine_version=self._engine.engine_version,
                doc_type=doc_type,
            )

        # OCR each page and concatenate text
        all_text_parts: list[str] = []
        for img_bytes in images:
            preprocessed = preprocess_image(img_bytes)
            page_text = self._engine.ocr_image(preprocessed, self._languages)
            all_text_parts.append(page_text)

        full_text = "\n".join(all_text_parts)

        # Parse fields from OCR text
        field_results = self._parse_fields(full_text, profile)

        # Build result dict
        fields: dict[str, Any] = {}
        confidences: list[float] = []
        for fr in field_results:
            if fr.value is not None:
                fields[fr.name] = fr.value
                confidences.append(fr.confidence)

        overall = sum(confidences) / len(confidences) if confidences else 0.0

        duration_ms = int((time.monotonic() - start) * 1000)

        return ExtractionResult(
            fields=fields,
            field_results=field_results,
            overall_confidence=round(overall, 3),
            page_count=len(images),
            duration_ms=duration_ms,
            engine=self._engine.engine_name,
            engine_version=self._engine.engine_version,
            doc_type=doc_type,
        )

    def extract_and_compare(
        self,
        file_bytes: bytes,
        content_type: str,
        declared: dict,
        doc_type: str = "FDR_SCAN",
    ) -> ExtractionResult:
        """Extract fields and compare with declared values (attach mode).

        Returns ExtractionResult with mismatches populated.
        """
        result = self.extract_with_profile(file_bytes, content_type, doc_type)

        if result.fields:
            # Map extracted field names to declared field names
            field_map = self._map_extracted_to_declared(result.fields)
            result.mismatches = compare_with_declared(field_map, declared)

        return result

    def _parse_fields(
        self, text: str, profile: ExtractionProfile
    ) -> list[FieldResult]:
        """Parse structured fields from raw OCR text using the profile."""
        results: list[FieldResult] = []
        text_lower = text.lower()
        lines = text.split("\n")

        for field_def in profile.fields:
            value, confidence, raw_match = self._extract_field(
                text, text_lower, lines, field_def
            )
            results.append(
                FieldResult(
                    name=field_def.name,
                    value=value,
                    confidence=confidence,
                    raw_match=raw_match,
                )
            )

        return results

    def _extract_field(
        self,
        text: str,
        text_lower: str,
        lines: list[str],
        field_def: FieldDef,
    ) -> tuple[Any, float, str | None]:
        """Extract a single field by searching for its aliases in the text.

        Returns (parsed_value, confidence, raw_match_text).
        """
        # Build search patterns from field name + aliases
        search_terms = [field_def.name.replace("_", " ")] + field_def.aliases

        for term in search_terms:
            term_lower = term.lower()
            # Search for "Label: Value" or "Label Value" patterns
            for line in lines:
                line_lower = line.lower().strip()
                if term_lower in line_lower:
                    # Extract the value part after the label
                    raw_value = self._extract_value_after_label(
                        line, term_lower
                    )
                    if raw_value and field_def.parser:
                        parsed = field_def.parser(raw_value)
                        if parsed is not None:
                            # Higher confidence if we found label + parsed OK
                            return parsed, 0.85, raw_value
                    elif raw_value and not field_def.parser:
                        # Free-text field (e.g. branch) — return as-is
                        return raw_value.strip(), 0.60, raw_value

        # Try parsing the entire text with the parser (lower confidence)
        if field_def.parser:
            parsed = field_def.parser(text)
            if parsed is not None:
                return parsed, 0.40, None

        return None, 0.0, None

    @staticmethod
    def _extract_value_after_label(line: str, label_lower: str) -> str | None:
        """Extract the value portion after a label in a line.

        Handles patterns like:
            "Amount: Rs. 1,25,000.00"
            "Bank Name    State Bank of India"
            "Date of Maturity : 05/03/2026"
        """
        line_lower = line.lower()
        idx = line_lower.find(label_lower)
        if idx == -1:
            return None

        after = line[idx + len(label_lower) :].strip()
        # Strip leading separators (: , - =)
        after = re.sub(r"^[\s:,\-=]+", "", after).strip()

        if not after:
            return None

        return after

    @staticmethod
    def _map_extracted_to_declared(extracted: dict) -> dict:
        """Map OCR field names to declared instrument field names.

        OCR uses 'fdr_number' but instrument has 'reference_number', etc.
        """
        mapping = {
            "fdr_number": "reference_number",
            "bank_name": "issuing_bank",
        }
        result: dict = {}
        for key, value in extracted.items():
            mapped_key = mapping.get(key, key)
            # Convert values to strings for comparison
            if value is not None:
                result[mapped_key] = str(value)
        return result
