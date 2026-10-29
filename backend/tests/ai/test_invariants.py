"""CRITICAL INVARIANT TEST — AI modules must NEVER modify core tables.

This test scans all Python files under app/ai/ and verifies that:
1. No AI module calls forbidden state-transition functions
2. No AI module directly writes to core instrument/verification/release tables
3. No AI module imports the `transition` function from instrument_state

This test MUST be in CI. If it fails, the build is broken.
"""

import ast
import re
from pathlib import Path

import pytest

AI_DIR = Path(__file__).resolve().parents[2] / "app" / "ai"

# Functions that AI modules must NEVER call
FORBIDDEN_CALLS = {
    "transition",
    "set_verification_tag",
    "approve",
    "reject",
    "release",
    "withdraw",
    "recommend",
}

# Modules that AI code must NEVER import from
FORBIDDEN_IMPORTS = {
    "app.services.instrument_state",
    "app.services.release_service",
    "app.services.instrument_service",
}

# Tables that AI code must NEVER write to (only AI-owned tables + validation_flags)
FORBIDDEN_TABLE_WRITES = {
    "instruments",
    "verification_records",
    "release_requests",
    "release_conditions",
    "release_condition_results",
    "users",
    "institutions",
}


def _collect_py_files():
    """Collect all Python files under app/ai/."""
    if not AI_DIR.exists():
        pytest.skip("app/ai/ directory not found")
    return list(AI_DIR.rglob("*.py"))


class TestAIInvariants:
    """Verify that AI modules respect the advisory-only invariant."""

    def test_no_forbidden_function_calls(self):
        """No AI module may call transition(), approve(), reject(), etc."""
        violations = []
        for py_file in _collect_py_files():
            try:
                tree = ast.parse(py_file.read_text(encoding="utf-8"))
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.Call):
                    func_name = ""
                    if isinstance(node.func, ast.Attribute):
                        func_name = node.func.attr
                    elif isinstance(node.func, ast.Name):
                        func_name = node.func.id

                    if func_name in FORBIDDEN_CALLS:
                        rel = py_file.relative_to(AI_DIR.parent.parent)
                        violations.append(
                            f"{rel}:{node.lineno} calls forbidden function '{func_name}'"
                        )

        assert not violations, (
            "AI modules call forbidden state-changing functions:\n"
            + "\n".join(violations)
        )

    def test_no_forbidden_imports(self):
        """No AI module may import from instrument_state or release services."""
        violations = []
        for py_file in _collect_py_files():
            try:
                tree = ast.parse(py_file.read_text(encoding="utf-8"))
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module:
                    for forbidden in FORBIDDEN_IMPORTS:
                        if node.module == forbidden or node.module.startswith(
                            forbidden + "."
                        ):
                            rel = py_file.relative_to(AI_DIR.parent.parent)
                            violations.append(
                                f"{rel}:{node.lineno} imports from '{node.module}'"
                            )

        assert not violations, (
            "AI modules import from forbidden core service modules:\n"
            + "\n".join(violations)
        )

    def test_no_direct_core_table_writes(self):
        """AI modules must not contain direct SQL writes to core tables."""
        violations = []
        write_patterns = [
            re.compile(
                r"""(?:insert|update|delete)\s+(?:into\s+)?['"]?"""
                + table
                + r"""['"]?""",
                re.IGNORECASE,
            )
            for table in FORBIDDEN_TABLE_WRITES
        ]

        for py_file in _collect_py_files():
            content = py_file.read_text(encoding="utf-8")
            for i, line in enumerate(content.split("\n"), 1):
                for pattern in write_patterns:
                    if pattern.search(line):
                        rel = py_file.relative_to(AI_DIR.parent.parent)
                        violations.append(f"{rel}:{i} — {line.strip()}")

        assert not violations, (
            "AI modules contain direct SQL writes to core tables:\n"
            + "\n".join(violations)
        )

    def test_ai_modules_exist(self):
        """Verify that all expected AI sub-packages exist."""
        expected = ["ocr", "trust", "prediction", "nlsearch", "feedback", "common"]
        for pkg in expected:
            pkg_dir = AI_DIR / pkg
            assert pkg_dir.is_dir(), f"Missing AI sub-package: app/ai/{pkg}"
            assert (pkg_dir / "__init__.py").exists(), (
                f"Missing __init__.py in app/ai/{pkg}"
            )
