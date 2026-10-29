"""LLM Payload Guard tests — verify allowlist blocks sensitive data."""

import pytest

from app.ai.common.payload_guard import (
    ALLOWED_FIELDS,
    PayloadGuardViolation,
    check_payload,
    sanitize_for_log,
)


class TestPayloadGuard:
    """Verify the LLM payload guard enforces data protection."""

    def test_allowed_fields_pass_through(self):
        """Allowed fields should be included in the filtered payload."""
        payload = {
            "status": "ACTIVE",
            "amount": 500000,
            "issuing_bank": "State Bank of India",
            "maturity_date": "2027-01-01",
            "institution_name": "Test University",
        }
        result = check_payload(payload)
        assert result == payload

    def test_blocked_password_raises(self):
        """Password fields must be blocked."""
        with pytest.raises(PayloadGuardViolation) as exc_info:
            check_payload({"password": "secret123", "status": "ACTIVE"})
        assert "password" in exc_info.value.blocked_fields

    def test_blocked_token_raises(self):
        """Token fields must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"access_token": "abc123"})

    def test_blocked_otp_raises(self):
        """OTP fields must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"otp": "123456"})

    def test_blocked_beneficiary_raises(self):
        """Beneficiary details must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"beneficiary_details": "John Doe, Acc: 123"})

    def test_blocked_document_bytes_raises(self):
        """Raw document bytes must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"document_bytes": b"PDF content"})

    def test_blocked_ocr_text_raises(self):
        """OCR extracted text must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"ocr_text": "Extracted text from FDR scan"})

    def test_blocked_email_raises(self):
        """Email fields must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"email": "user@example.com"})

    def test_blocked_phone_raises(self):
        """Phone fields must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"phone": "+919876543210"})

    def test_blocked_jwt_raises(self):
        """JWT fields must be blocked."""
        with pytest.raises(PayloadGuardViolation):
            check_payload({"jwt": "eyJhbGciOiJIUzI1NiJ9..."})

    def test_unknown_fields_silently_dropped(self):
        """Unknown (not allowed, not blocked) fields are silently dropped."""
        payload = {
            "status": "ACTIVE",
            "unknown_field": "some value",
            "random_data": 42,
        }
        result = check_payload(payload)
        assert "status" in result
        assert "unknown_field" not in result
        assert "random_data" not in result

    def test_empty_payload(self):
        """Empty payload should return empty dict."""
        assert check_payload({}) == {}

    def test_sanitize_for_log_redacts(self):
        """Sanitize should redact blocked fields for logging."""
        payload = {
            "status": "ACTIVE",
            "password": "secret",
            "otp": "123456",
        }
        result = sanitize_for_log(payload)
        assert result["status"] == "ACTIVE"
        assert result["password"] == "[REDACTED]"
        assert result["otp"] == "[REDACTED]"

    def test_multiple_blocked_fields(self):
        """Multiple blocked fields should all be reported."""
        with pytest.raises(PayloadGuardViolation) as exc_info:
            check_payload({
                "password": "x",
                "token": "y",
                "otp": "z",
            })
        assert len(exc_info.value.blocked_fields) == 3
