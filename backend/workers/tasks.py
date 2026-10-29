"""Celery tasks entrypoint."""
from app.workers.tasks import daily_scan_task, send_pending_alerts_task, run_escalation_task

__all__ = ["daily_scan_task", "send_pending_alerts_task", "run_escalation_task"]
