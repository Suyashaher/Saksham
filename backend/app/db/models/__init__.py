"""Re-export all models so Alembic and the app can import from one place."""

from app.db.models.institution import Institution
from app.db.models.user import User
from app.db.models.instrument import Instrument
from app.db.models.document import Document
from app.db.models.verification import VerificationRecord
from app.db.models.renewal import RenewalLink
from app.db.models.release import ReleaseRequest
from app.db.models.release_condition import ReleaseCondition, ReleaseConditionResult
from app.db.models.alert_rule import AlertRule
from app.db.models.alert import Alert
from app.db.models.notification import Notification
from app.db.models.audit import AuditLog
from app.db.models.feedback import FeedbackLabel
from app.db.models.otp_challenge import OtpChallenge
from app.db.models.refresh_token import RefreshToken
from app.db.models.failed_login import FailedLoginAttempt
from app.db.models.status_history import InstrumentStatusHistory
from app.db.models.observation import ScrutinyObservation
from app.db.models.mock_bank import MockBankRegistry
from app.db.models.ai_models import (
    TrustScoreWeight,
    TrustScoreSnapshot,
    PredictionSnapshot,
    AIModel,
    OcrRun,
    NLSearchLog,
)

__all__ = [
    "Institution",
    "User",
    "Instrument",
    "Document",
    "VerificationRecord",
    "RenewalLink",
    "ReleaseRequest",
    "ReleaseCondition",
    "ReleaseConditionResult",
    "AlertRule",
    "Alert",
    "Notification",
    "AuditLog",
    "FeedbackLabel",
    "OtpChallenge",
    "RefreshToken",
    "FailedLoginAttempt",
    "InstrumentStatusHistory",
    "ScrutinyObservation",
    "MockBankRegistry",
    "TrustScoreWeight",
    "TrustScoreSnapshot",
    "PredictionSnapshot",
    "AIModel",
    "OcrRun",
    "NLSearchLog",
]
