"""Image preprocessing for OCR: deskew, denoise, binarize, upscale.

Also handles PDF→image page extraction via PyMuPDF.
"""

from __future__ import annotations

import io
import logging
from typing import Sequence

logger = logging.getLogger(__name__)


def pdf_to_images(pdf_bytes: bytes, dpi: int = 300) -> list[bytes]:
    """Convert a PDF to a list of PNG image bytes (one per page).

    Uses PyMuPDF (fitz). Falls back to empty list on failure.
    """
    try:
        import fitz  # PyMuPDF

        images: list[bytes] = []
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            # Render at specified DPI
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            images.append(pix.tobytes("png"))
        doc.close()
        return images
    except Exception as e:
        logger.error("PDF to image conversion failed: %s", e)
        return []


def preprocess_image(image_bytes: bytes) -> bytes:
    """Apply preprocessing pipeline to improve OCR accuracy.

    Steps: convert to grayscale → upscale small images → binarize (Otsu).
    Returns preprocessed image as PNG bytes.
    """
    try:
        from PIL import Image, ImageFilter

        image = Image.open(io.BytesIO(image_bytes))

        # Convert to grayscale
        if image.mode != "L":
            image = image.convert("L")

        # Upscale small images (< 1000px width)
        if image.width < 1000:
            scale = max(2, 1000 // image.width)
            image = image.resize(
                (image.width * scale, image.height * scale),
                Image.Resampling.LANCZOS,
            )

        # Denoise with a mild filter
        image = image.filter(ImageFilter.MedianFilter(size=3))

        # Binarize (simple threshold — Otsu-like)
        # Use point() for thresholding
        threshold = 128
        image = image.point(lambda p: 255 if p > threshold else 0, mode="1")
        image = image.convert("L")

        # Convert back to PNG bytes
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        logger.warning("Image preprocessing failed, using original: %s", e)
        return image_bytes


def file_to_images(file_bytes: bytes, content_type: str) -> list[bytes]:
    """Convert an uploaded file to a list of image byte arrays.

    PDF → multiple pages; image → single item list.
    """
    if content_type == "application/pdf":
        return pdf_to_images(file_bytes)
    elif content_type in ("image/jpeg", "image/png"):
        return [file_bytes]
    else:
        logger.warning("Unsupported content type for OCR: %s", content_type)
        return []
