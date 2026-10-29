"""Tests for Celery task definitions, schedulers, and execution."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
import pytest

from app.workers.celery_app import celery_app
from app.workers.tasks import (
    daily_scan_task,
    run_escalation_task,
    send_pending_alerts_task,
)


celery_app.conf.task_always_eager = True
celery_app.conf.result_backend = "cache+memory://"


def test_celery_app_configuration():
    """Verify Celery app broker, timezone, and scheduled beat tasks."""
    assert celery_app.conf.timezone == "Asia/Kolkata"
    schedule = celery_app.conf.beat_schedule
    assert "daily_scan" in schedule
    assert "send_pending_alerts" in schedule
    assert "run_escalation" in schedule


def test_celery_task_registration():
    """Verify tasks are registered on the Celery application."""
    assert "workers.tasks.daily_scan_task" in celery_app.tasks
    assert "workers.tasks.send_pending_alerts_task" in celery_app.tasks
    assert "workers.tasks.run_escalation_task" in celery_app.tasks


def test_daily_scan_task_invocation():
    """Verify daily_scan_task dispatches to async scanner."""
    with patch("asyncio.run") as mock_run:
        mock_run.return_value = {"transitioned_expiring": 0, "transitioned_matured": 0, "alerts_created": 0}
        res = daily_scan_task()
        mock_run.assert_called_once()
        assert res["alerts_created"] == 0


def test_run_escalation_task_invocation():
    """Verify run_escalation_task dispatches to async escalation."""
    with patch("asyncio.run") as mock_run:
        mock_run.return_value = {"escalated_alerts": 0}
        res = run_escalation_task()
        mock_run.assert_called_once()
        assert res["escalated_alerts"] == 0


def test_send_pending_alerts_task_invocation():
    """Verify send_pending_alerts_task dispatches to alert sender."""
    with patch("asyncio.run") as mock_run:
        mock_run.return_value = 5
        res = send_pending_alerts_task(batch_size=10)
        mock_run.assert_called_once()
        assert res == 5
