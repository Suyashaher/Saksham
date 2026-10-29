"""OTP delivery interface and console implementation for dev."""

from __future__ import annotations

import abc
import logging

from app.db.models.user import User

logger = logging.getLogger(__name__)


class OtpSender(abc.ABC):
    """Abstract interface for OTP delivery."""

    @abc.abstractmethod
    async def send(self, user: User, otp: str) -> None:
        """Deliver the OTP to the user (email, SMS, etc.)."""
        ...


class ConsoleOtpSender(OtpSender):
    """Logs the OTP to console — for development only."""

    async def send(self, user: User, otp: str) -> None:
        logger.info(
            "📱 [DEV OTP] User=%s (%s) → OTP=%s",
            user.email,
            user.id,
            otp,
        )


def get_otp_sender() -> OtpSender:
    """Factory — returns the configured OTP sender."""
    return ConsoleOtpSender()
