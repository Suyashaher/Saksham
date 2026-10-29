"""Alert sender service — delivery interfaces for Email, SMS, and in-app notifications."""

from __future__ import annotations

import asyncio
import email.message
import logging
import os
import smtplib
from abc import ABC, abstractmethod
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Locate templates directory
_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "alerts"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=True,
)


def mask_reference_number(ref: str) -> str:
    """Mask reference number for SMS, keeping only the last 4 characters."""
    if not ref:
        return "****"
    if len(ref) <= 4:
        return "*" * len(ref)
    return ("*" * (len(ref) - 4)) + ref[-4:]


def render_template(template_name: str, context: dict) -> str:
    """Render a Jinja2 template with context."""
    template = _jinja_env.get_template(template_name)
    return template.render(**context)


# ── Delivery ABCs ─────────────────────────────────────────────────────────────


class EmailSender(ABC):
    @abstractmethod
    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        """Send an email with both HTML and plain-text versions."""
        ...


class SmsSender(ABC):
    @abstractmethod
    async def send(self, to_phone: str, body: str) -> None:
        """Send an SMS notification."""
        ...


# ── Implementations ───────────────────────────────────────────────────────────


class SmtpEmailSender(EmailSender):
    """SMTP email sender (connects to MailHog in dev or configured SMTP in prod)."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        user: str | None = None,
        password: str | None = None,
        from_email: str | None = None,
        use_tls: bool = False,
    ) -> None:
        settings = get_settings()
        self.host = host or settings.SMTP_HOST
        self.port = port or settings.SMTP_PORT
        self.user = user or settings.SMTP_USER
        self.password = password or settings.SMTP_PASSWORD
        self.from_email = from_email or settings.SMTP_FROM
        self.use_tls = use_tls or settings.SMTP_TLS

    def _sync_send(self, to: str, subject: str, html: str, text: str) -> None:
        msg = email.message.EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.from_email
        msg["To"] = to
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")

        with smtplib.SMTP(self.host, self.port, timeout=10) as client:
            if self.use_tls:
                client.starttls()
            if self.user and self.password:
                client.login(self.user, self.password)
            client.send_message(msg)

    async def send(self, to: str, subject: str, html: str, text: str) -> None:
        try:
            await asyncio.to_thread(self._sync_send, to, subject, html, text)
            logger.info("Sent email to %s: %s", to, subject)
        except Exception as e:
            logger.warning("Failed to send email to %s via SMTP (%s:%d): %s", to, self.host, self.port, e)
            raise


class ConsoleSmsSender(SmsSender):
    """Console SMS sender for development and testing — logs SMS output."""

    async def send(self, to_phone: str, body: str) -> None:
        logger.info("[SMS to %s]: %s", to_phone, body)
        # Also print for test visibility
        print(f"\n--- [CONSOLE SMS] to {to_phone} ---\n{body}\n---------------------------")


class TwilioSmsSender(SmsSender):
    """Twilio SMS sender stub."""

    async def send(self, to_phone: str, body: str) -> None:
        raise NotImplementedError("Twilio SMS integration will be implemented in Phase 6")


def get_email_sender() -> EmailSender:
    """Factory for EmailSender."""
    return SmtpEmailSender()


def get_sms_sender() -> SmsSender:
    """Factory for SmsSender."""
    settings = get_settings()
    if settings.SMS_PROVIDER.lower() == "twilio":
        return TwilioSmsSender()
    return ConsoleSmsSender()
