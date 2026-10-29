"""Clock discipline test — asserts that services/ and workers/ never call
date.today() or datetime.now() directly, ensuring testability and demo time-shifting.
"""

from __future__ import annotations

import re
from pathlib import Path

FORBIDDEN_PATTERNS = [
    re.compile(r"\bdate\.today\(\)"),
    re.compile(r"\bdatetime\.now\(\)"),
]

DIRECTORIES_TO_CHECK = [
    Path(__file__).resolve().parent.parent / "app" / "services",
    Path(__file__).resolve().parent.parent / "app" / "workers",
]


def test_no_direct_date_today_or_datetime_now_in_services_or_workers():
    """Verify all date/time access in services and workers goes through app.core.clock."""
    violations: list[str] = []

    for directory in DIRECTORIES_TO_CHECK:
        if not directory.exists():
            continue
        for py_file in directory.rglob("*.py"):
            text = py_file.read_text(encoding="utf-8")
            for line_no, line in enumerate(text.splitlines(), start=1):
                # Ignore comments
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                for pattern in FORBIDDEN_PATTERNS:
                    if pattern.search(line):
                        violations.append(f"{py_file.name}:{line_no} -> {line.strip()}")

    assert not violations, (
        f"Clock discipline violations found ({len(violations)}). "
        f"All date/time logic must call app.core.clock.today() / now():\n"
        + "\n".join(violations)
    )
