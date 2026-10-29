"""Tests for the app.core.clock abstraction."""

from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo

import pytest

from app.core import clock
from app.core.config import get_settings


def test_clock_today_and_now_are_ist():
    """Verify default clock uses Asia/Kolkata timezone."""
    clock.clear_test_override()
    d = clock.today()
    n = clock.now()

    assert isinstance(d, datetime.date)
    assert isinstance(n, datetime.datetime)
    assert n.tzinfo == ZoneInfo("Asia/Kolkata")
    assert n.date() == d


def test_test_override_fixture():
    """Verify test override sets date and time and clears cleanly."""
    override_date = datetime.date(2030, 5, 15)
    clock.set_test_override(override_date)

    try:
        assert clock.today() == override_date
        n = clock.now()
        assert n.date() == override_date
        assert n.year == 2030
        assert n.month == 5
        assert n.day == 15
    finally:
        clock.clear_test_override()

    assert clock.today() != override_date


def test_demo_mode_override(monkeypatch):
    """Verify CLOCK_OVERRIDE_DATE works only when DEMO_MODE=true."""
    clock.clear_test_override()
    settings = get_settings()

    # When DEMO_MODE is False, CLOCK_OVERRIDE_DATE is ignored
    monkeypatch.setattr(settings, "DEMO_MODE", False)
    monkeypatch.setattr(settings, "CLOCK_OVERRIDE_DATE", "2035-12-31")
    assert clock.today() != datetime.date(2035, 12, 31)

    # When DEMO_MODE is True, CLOCK_OVERRIDE_DATE is respected
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    assert clock.today() == datetime.date(2035, 12, 31)
    assert clock.now().date() == datetime.date(2035, 12, 31)
