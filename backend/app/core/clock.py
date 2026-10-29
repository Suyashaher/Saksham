"""Clock abstraction for Phase 4 — ALL date/time usage in services/tasks must call
these functions instead of datetime.date.today() or datetime.datetime.now().

Override mechanism (for tests and DEMO_MODE):
  - Set CLOCK_OVERRIDE_DATE env var (YYYY-MM-DD) when DEMO_MODE=true for calendar demos.
  - Call set_test_override(date) / clear_test_override() in pytest fixtures.
"""

from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo

_IST = ZoneInfo("Asia/Kolkata")

# Test-only override — set via set_test_override(), cleared via clear_test_override().
# Module-level so tests can monkey-patch per-fixture.
_test_override: datetime.date | None = None


def set_test_override(d: datetime.date | None) -> None:
    """Override the clock for unit tests. Call clear_test_override() in teardown."""
    global _test_override
    _test_override = d


def clear_test_override() -> None:
    """Remove any test clock override."""
    global _test_override
    _test_override = None


def today() -> datetime.date:
    """Return today's date in IST (Asia/Kolkata).

    Priority:
    1. Test override (set_test_override).
    2. CLOCK_OVERRIDE_DATE env var when DEMO_MODE=true.
    3. Real IST date.
    """
    if _test_override is not None:
        return _test_override

    # Lazy import to avoid circular deps at module load
    from app.core.config import get_settings

    s = get_settings()
    if s.DEMO_MODE and s.CLOCK_OVERRIDE_DATE:
        try:
            return datetime.date.fromisoformat(s.CLOCK_OVERRIDE_DATE)
        except ValueError:
            pass  # Fall through to real date

    return datetime.datetime.now(_IST).date()


def now() -> datetime.datetime:
    """Return the current timezone-aware datetime in IST (Asia/Kolkata).

    Priority same as today(). When using override, returns midnight IST on that date.
    """
    if _test_override is not None:
        return datetime.datetime(_test_override.year, _test_override.month,
                                 _test_override.day, tzinfo=_IST)

    from app.core.config import get_settings

    s = get_settings()
    if s.DEMO_MODE and s.CLOCK_OVERRIDE_DATE:
        try:
            d = datetime.date.fromisoformat(s.CLOCK_OVERRIDE_DATE)
            return datetime.datetime(d.year, d.month, d.day, tzinfo=_IST)
        except ValueError:
            pass

    return datetime.datetime.now(_IST)
