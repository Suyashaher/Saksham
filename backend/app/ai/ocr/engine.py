"""OCR engine wrapper — Tesseract with graceful degradation.

SECURITY: OCR runs locally only. No document content ever leaves the system.
The extracted text is NEVER logged — only field-level confidence scores.
"""

from __future__ import annotations

import logging
import subprocess
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class OcrEngine(ABC):
    """Abstract OCR engine interface."""

    @abstractmethod
    def ocr_image(self, image_bytes: bytes, languages: str = "eng+hin") -> str:
        """Extract raw text from an image. Returns empty string on failure."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the OCR engine is operational."""
        ...

    @property
    @abstractmethod
    def engine_name(self) -> str:
        ...

    @property
    @abstractmethod
    def engine_version(self) -> str:
        ...


class TesseractEngine(OcrEngine):
    """Tesseract 5+ OCR engine wrapper via pytesseract."""

    def __init__(self, tesseract_cmd: str = "tesseract") -> None:
        self._cmd = tesseract_cmd
        self._version: str | None = None
        self._available: bool | None = None

    def is_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            import pytesseract

            pytesseract.pytesseract.tesseract_cmd = self._cmd
            self._version = pytesseract.get_tesseract_version().public
            self._available = True
        except Exception as e:
            logger.warning("Tesseract not available: %s", e)
            self._available = False
            self._version = "unavailable"
        return self._available

    @property
    def engine_name(self) -> str:
        return "tesseract"

    @property
    def engine_version(self) -> str:
        if self._version is None:
            self.is_available()
        return self._version or "unknown"

    def ocr_image(self, image_bytes: bytes, languages: str = "eng+hin") -> str:
        """Run Tesseract OCR on image bytes. Returns extracted text."""
        if not self.is_available():
            return ""

        try:
            import pytesseract
            from PIL import Image
            import io

            pytesseract.pytesseract.tesseract_cmd = self._cmd
            image = Image.open(io.BytesIO(image_bytes))

            # Use LSTM engine (--oem 1) for better accuracy
            custom_config = f"--oem 1 --psm 6 -l {languages}"
            text = pytesseract.image_to_string(image, config=custom_config)
            return text
        except Exception as e:
            logger.error("Tesseract OCR failed: %s", e)
            return ""


class NullEngine(OcrEngine):
    """No-op OCR engine — used when Tesseract is unavailable."""

    def ocr_image(self, image_bytes: bytes, languages: str = "eng+hin") -> str:
        return ""

    def is_available(self) -> bool:
        return False

    @property
    def engine_name(self) -> str:
        return "null"

    @property
    def engine_version(self) -> str:
        return "n/a"


def get_ocr_engine(tesseract_cmd: str = "tesseract") -> OcrEngine:
    """Factory: returns TesseractEngine if available, else NullEngine."""
    engine = TesseractEngine(tesseract_cmd)
    if engine.is_available():
        return engine
    logger.warning("Falling back to NullEngine — OCR will not extract text")
    return NullEngine()
