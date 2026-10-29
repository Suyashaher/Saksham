"""Celery application configuration with Redis broker and Asia/Kolkata timezone."""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "fdr_portal",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    beat_schedule={
        "daily_scan": {
            "task": "workers.tasks.daily_scan_task",
            "schedule": crontab(
                hour=settings.DAILY_SCAN_HOUR,
                minute=settings.DAILY_SCAN_MINUTE,
            ),
        },
        "send_pending_alerts": {
            "task": "workers.tasks.send_pending_alerts_task",
            "schedule": crontab(minute="*/5"),
        },
        "run_escalation": {
            "task": "workers.tasks.run_escalation_task",
            "schedule": crontab(
                hour=settings.DAILY_SCAN_HOUR,
                minute=settings.DAILY_SCAN_MINUTE + 10,
            ),
        },
        # Phase 7B — AI tasks
        "nightly_trust_recompute": {
            "task": "workers.ai_tasks.nightly_trust_recompute",
            "schedule": crontab(
                hour=settings.TRUST_SCORE_RECOMPUTE_HOUR,
                minute=0,
            ),
        },
        "weekly_retrain_prediction": {
            "task": "workers.ai_tasks.weekly_retrain_prediction",
            "schedule": crontab(
                hour=settings.PREDICTION_RETRAIN_HOUR,
                minute=0,
                day_of_week=settings.PREDICTION_RETRAIN_DAY,
            ),
        },
    },
)
