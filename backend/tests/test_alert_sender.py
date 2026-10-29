"""Tests for alert sender delivery backends, reference number masking, and templates."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.alert_sender import (
    ConsoleSmsSender,
    SmtpEmailSender,
    TwilioSmsSender,
    mask_reference_number,
    render_template,
)


def test_mask_reference_number():
    """SMS must mask all but the last 4 characters of the reference number."""
    assert mask_reference_number("FDR-SBI-2026-9876") == ("*" * 13) + "9876"
    assert mask_reference_number("12345") == "*2345"
    assert mask_reference_number("1234") == "****"
    assert mask_reference_number("AB") == "**"
    assert mask_reference_number("") == "****"


def test_template_rendering():
    """Verify all Jinja2 alert templates render without syntax or missing variable errors."""
    context = {
        "institution_name": "Indian Institute of Science",
        "ref_number_masked": "****9876",
        "maturity_date": "2026-12-31",
        "days_remaining": 65,
        "days_overdue": 5,
        "days_stale": 30,
        "days_unresolved": 14,
        "current_status": "UNDER_SCRUTINY",
        "portal_url": "http://localhost:8000",
    }

    templates = [
        ("maturity_reminder.html", "Security Deposit Maturity Notice"),
        ("maturity_reminder.txt", "Security Deposit Maturity Notice"),
        ("overdue_matured.html", "URGENT: AICTE Security Deposit Matured"),
        ("overdue_matured.txt", "URGENT: AICTE Security Deposit Matured"),
        ("stale_verification.html", "Stale Scrutiny / Verification"),
        ("stale_verification.txt", "Stale Scrutiny / Verification"),
        ("discrepancy_unresolved.html", "Unresolved FDR Discrepancy"),
        ("discrepancy_unresolved.txt", "Unresolved FDR Discrepancy"),
        ("sms_maturity.txt", "AICTE FDR Alert"),
    ]

    for tmpl_name, expected_snippet in templates:
        rendered = render_template(tmpl_name, context)
        assert expected_snippet in rendered, f"Snippet missing in {tmpl_name}"
        assert "****9876" in rendered, f"Masked ref missing in {tmpl_name}"


@pytest.mark.asyncio
async def test_console_sms_sender():
    """Console SMS sender should log and output without error."""
    sender = ConsoleSmsSender()
    await sender.send("+919876543210", "Test SMS body")


@pytest.mark.asyncio
async def test_twilio_sms_sender_stub():
    """Twilio sender raises NotImplementedError in Phase 4."""
    sender = TwilioSmsSender()
    with pytest.raises(NotImplementedError):
        await sender.send("+919876543210", "Test SMS body")


@pytest.mark.asyncio
async def test_smtp_email_sender_dispatch():
    """Verify SmtpEmailSender invokes SMTP client send."""
    sender = SmtpEmailSender(host="localhost", port=1025)

    with patch.object(sender, "_sync_send") as mock_sync:
        await sender.send(
            to="test@dtu.ac.in",
            subject="Test Subject",
            html="<p>Test</p>",
            text="Test",
        )
        mock_sync.assert_called_once_with("test@dtu.ac.in", "Test Subject", "<p>Test</p>", "Test")
