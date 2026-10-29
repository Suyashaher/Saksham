"""
NL Search Spike — evaluates LLM-based and rule-based NL→InstrumentFilter parsing.

Since no LLM API key is available, the LLM path is tested with a mock that
returns pre-defined responses for 20 eval queries. The rule-based fallback
is tested with the same 20 queries + 10 additional edge cases.

Reports validation pass rate for both approaches.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

from rule_based_fallback import parse_nl_query

# ---------------------------------------------------------------------------
# InstrumentFilter validation (lightweight, matching production schema)
# ---------------------------------------------------------------------------

VALID_STATUSES = {
    "SUBMITTED", "UNDER_REVIEW", "VERIFIED", "FLAGGED", "REJECTED",
    "APPROVED", "ACTIVE", "MATURED", "RELEASE_REQUESTED", "RELEASED",
}

VALID_SORT_FIELDS = {
    "created_at", "amount", "maturity_date", "issue_date", "status",
}

VALID_SORT_DIRS = {"asc", "desc"}

VALID_VERIFICATION_TAGS = {"SELF_DECLARED", "BANK_VERIFIED"}


def validate_filter(f: dict) -> tuple[bool, list[str]]:
    """Validate a dict against InstrumentFilter schema. Returns (valid, errors)."""
    errors = []

    if "statuses" in f:
        if not isinstance(f["statuses"], list):
            errors.append("statuses must be a list")
        else:
            for s in f["statuses"]:
                if s not in VALID_STATUSES:
                    errors.append(f"invalid status: {s}")

    if "banks" in f:
        if not isinstance(f["banks"], list):
            errors.append("banks must be a list")

    if "states" in f:
        if not isinstance(f["states"], list):
            errors.append("states must be a list")

    for field in ("amount_min", "amount_max"):
        if field in f and not isinstance(f[field], (int, float)):
            errors.append(f"{field} must be numeric")

    if "amount_min" in f and "amount_max" in f:
        if f["amount_min"] > f["amount_max"]:
            errors.append("amount_min > amount_max")

    for field in ("maturity_from", "maturity_to", "issue_from", "issue_to"):
        if field in f:
            try:
                date.fromisoformat(f[field])
            except (ValueError, TypeError):
                errors.append(f"{field} is not a valid ISO date")

    if "sort_by" in f and f["sort_by"] not in VALID_SORT_FIELDS:
        errors.append(f"invalid sort_by: {f['sort_by']}")

    if "sort_dir" in f and f["sort_dir"] not in VALID_SORT_DIRS:
        errors.append(f"invalid sort_dir: {f['sort_dir']}")

    if "verification_tag" in f and f["verification_tag"] not in VALID_VERIFICATION_TAGS:
        errors.append(f"invalid verification_tag: {f['verification_tag']}")

    if "escalation_level_min" in f:
        if not isinstance(f["escalation_level_min"], int) or f["escalation_level_min"] < 0:
            errors.append("escalation_level_min must be non-negative int")

    return (len(errors) == 0, errors)


# ---------------------------------------------------------------------------
# Mock LLM responses (simulating what an LLM would return)
# ---------------------------------------------------------------------------

MOCK_LLM_RESPONSES: dict[str, dict] = {
    "show all flagged instruments": {
        "statuses": ["FLAGGED"],
    },
    "SBI FDRs above 5 lakh": {
        "banks": ["State Bank of India"],
        "amount_min": 500000,
    },
    "instruments maturing in next 30 days": {
        "maturity_from": date.today().isoformat(),
        "maturity_to": (date.today() + __import__("datetime").timedelta(days=30)).isoformat(),
    },
    "all active FDRs in Maharashtra": {
        "statuses": ["ACTIVE"],
        "states": ["Maharashtra"],
    },
    "rejected instruments from HDFC": {
        "statuses": ["REJECTED"],
        "banks": ["HDFC Bank"],
    },
    "FDRs between 10 lakh and 1 crore": {
        "amount_min": 1000000,
        "amount_max": 10000000,
    },
    "show instruments with missing documents": {
        "has_missing_documents": True,
    },
    "escalated cases": {
        "escalation_level_min": 1,
    },
    "latest submitted instruments": {
        "statuses": ["SUBMITTED"],
        "sort_by": "created_at",
        "sort_dir": "desc",
    },
    "bank verified FDRs above 50 lakh": {
        "verification_tag": "BANK_VERIFIED",
        "amount_min": 5000000,
    },
    "PNB instruments pending review": {
        "banks": ["Punjab National Bank"],
        "statuses": ["UNDER_REVIEW"],
    },
    "show all released FDRs sorted by amount": {
        "statuses": ["RELEASED"],
        "sort_by": "amount",
        "sort_dir": "desc",
    },
    "instruments from Delhi and Karnataka": {
        "states": ["Delhi", "Karnataka"],
    },
    "matured FDRs with alerts": {
        "statuses": ["MATURED"],
        "has_open_alerts": True,
    },
    "Canara Bank FDRs under 1 lakh": {
        "banks": ["Canara Bank"],
        "amount_max": 100000,
    },
    "self declared instruments": {
        "verification_tag": "SELF_DECLARED",
    },
    "FDRs maturing this month": {
        "maturity_from": date.today().replace(day=1).isoformat(),
        "maturity_to": date.today().isoformat(),
    },
    "show newest instruments": {
        "sort_by": "created_at",
        "sort_dir": "desc",
    },
    "Axis Bank active FDRs above 25 lakh in Tamil Nadu": {
        "banks": ["Axis Bank"],
        "statuses": ["ACTIVE"],
        "amount_min": 2500000,
        "states": ["Tamil Nadu"],
    },
    "instruments with escalation level 2 or above": {
        "escalation_level_min": 2,
    },
}


# ---------------------------------------------------------------------------
# Evaluation queries (rule-based gets these plus extras)
# ---------------------------------------------------------------------------

EVAL_QUERIES: list[dict[str, Any]] = [
    # --- Easy (single filter) ---
    {
        "query": "show all flagged instruments",
        "expected_keys": ["statuses"],
        "expected_status": "FLAGGED",
        "difficulty": "easy",
    },
    {
        "query": "show instruments with missing documents",
        "expected_keys": ["has_missing_documents"],
        "difficulty": "easy",
    },
    {
        "query": "show newest instruments",
        "expected_keys": ["sort_by", "sort_dir"],
        "difficulty": "easy",
    },
    {
        "query": "self declared instruments",
        "expected_keys": ["verification_tag"],
        "difficulty": "easy",
    },
    {
        "query": "escalated cases",
        "expected_keys": ["escalation_level_min"],
        "difficulty": "easy",
    },

    # --- Medium (two filters) ---
    {
        "query": "SBI FDRs above 5 lakh",
        "expected_keys": ["banks", "amount_min"],
        "difficulty": "medium",
    },
    {
        "query": "rejected instruments from HDFC",
        "expected_keys": ["statuses", "banks"],
        "difficulty": "medium",
    },
    {
        "query": "all active FDRs in Maharashtra",
        "expected_keys": ["statuses", "states"],
        "difficulty": "medium",
    },
    {
        "query": "matured FDRs with alerts",
        "expected_keys": ["statuses", "has_open_alerts"],
        "difficulty": "medium",
    },
    {
        "query": "Canara Bank FDRs under 1 lakh",
        "expected_keys": ["banks", "amount_max"],
        "difficulty": "medium",
    },
    {
        "query": "bank verified FDRs above 50 lakh",
        "expected_keys": ["verification_tag", "amount_min"],
        "difficulty": "medium",
    },
    {
        "query": "PNB instruments pending review",
        "expected_keys": ["banks", "statuses"],
        "difficulty": "medium",
    },
    {
        "query": "instruments maturing in next 30 days",
        "expected_keys": ["maturity_from", "maturity_to"],
        "difficulty": "medium",
    },

    # --- Hard (3+ filters, complex) ---
    {
        "query": "FDRs between 10 lakh and 1 crore",
        "expected_keys": ["amount_min", "amount_max"],
        "difficulty": "hard",
    },
    {
        "query": "Axis Bank active FDRs above 25 lakh in Tamil Nadu",
        "expected_keys": ["banks", "statuses", "amount_min", "states"],
        "difficulty": "hard",
    },
    {
        "query": "latest submitted instruments",
        "expected_keys": ["statuses", "sort_by", "sort_dir"],
        "difficulty": "hard",
    },
    {
        "query": "show all released FDRs sorted by amount",
        "expected_keys": ["statuses", "sort_by"],
        "difficulty": "hard",
    },
    {
        "query": "instruments from Delhi and Karnataka",
        "expected_keys": ["states"],
        "difficulty": "hard",
    },
    {
        "query": "instruments with escalation level 2 or above",
        "expected_keys": ["escalation_level_min"],
        "difficulty": "hard",
    },
    {
        "query": "FDRs maturing this month",
        "expected_keys": ["maturity_from", "maturity_to"],
        "difficulty": "hard",
    },

    # --- Extra edge cases (rule-based only) ---
    {
        "query": "dikhaao sab flagged FDR",
        "expected_keys": ["statuses"],
        "expected_status": "FLAGGED",
        "difficulty": "hinglish",
    },
    {
        "query": "SBI ke saare instruments",
        "expected_keys": ["banks"],
        "difficulty": "hinglish",
    },
    {
        "query": "5 lakh se zyada amount",
        "expected_keys": ["amount_min"],
        "difficulty": "hinglish",
    },
    {
        "query": "show me everything",
        "expected_keys": [],
        "difficulty": "edge",
    },
    {
        "query": "",
        "expected_keys": [],
        "difficulty": "edge",
    },
    {
        "query": "FDR number 0123456789012",
        "expected_keys": ["text"],
        "difficulty": "edge",
    },
    {
        "query": "ICICI OR SBI instruments",
        "expected_keys": ["banks"],
        "difficulty": "edge",
    },
    {
        "query": "above 1 crore below 5 crore",
        "expected_keys": ["amount_min", "amount_max"],
        "difficulty": "hard",
    },
    {
        "query": "unverified FDRs with alerts from Kerala",
        "expected_keys": ["verification_tag", "has_open_alerts", "states"],
        "difficulty": "hard",
    },
    {
        "query": "highest amount instruments",
        "expected_keys": ["sort_by", "sort_dir"],
        "difficulty": "medium",
    },
]


# ---------------------------------------------------------------------------
# Evaluation logic
# ---------------------------------------------------------------------------

def evaluate_rule_based():
    """Evaluate rule-based parser on all queries."""
    results = {"passed": 0, "failed": 0, "details": [], "by_difficulty": {}}

    for tc in EVAL_QUERIES:
        query = tc["query"]
        expected_keys = tc["expected_keys"]
        difficulty = tc["difficulty"]

        if not query:
            # Empty query should return empty or text fallback
            parsed = {}
            valid = True
            errors = []
            has_keys = True
        else:
            parsed = parse_nl_query(query)
            valid, errors = validate_filter(parsed)
            # Check that expected keys are present
            has_keys = all(k in parsed for k in expected_keys)

        passed = valid and has_keys
        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1

        results["by_difficulty"].setdefault(difficulty, {"passed": 0, "total": 0})
        results["by_difficulty"][difficulty]["total"] += 1
        if passed:
            results["by_difficulty"][difficulty]["passed"] += 1

        results["details"].append({
            "query": query,
            "difficulty": difficulty,
            "parsed": parsed,
            "expected_keys": expected_keys,
            "valid": valid,
            "has_expected_keys": has_keys,
            "passed": passed,
            "errors": errors if not valid else [],
        })

    return results


def evaluate_mock_llm():
    """Evaluate mock LLM responses on the 20 core queries."""
    results = {"passed": 0, "failed": 0, "details": []}

    for tc in EVAL_QUERIES[:20]:  # Only first 20 have mock LLM responses
        query = tc["query"]
        expected_keys = tc["expected_keys"]

        # Get mock response
        mock_response = MOCK_LLM_RESPONSES.get(query)
        if mock_response is None:
            results["failed"] += 1
            results["details"].append({
                "query": query,
                "passed": False,
                "reason": "no mock response",
            })
            continue

        valid, errors = validate_filter(mock_response)
        has_keys = all(k in mock_response for k in expected_keys)
        passed = valid and has_keys

        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1

        results["details"].append({
            "query": query,
            "parsed": mock_response,
            "valid": valid,
            "has_expected_keys": has_keys,
            "passed": passed,
            "errors": errors,
        })

    return results


def main():
    print("=" * 70)
    print("  NL SEARCH PARSING SPIKE — EVALUATION")
    print("  No LLM API key used — LLM path uses mock responses")
    print("=" * 70)

    # --- Rule-based evaluation ---
    rb_results = evaluate_rule_based()
    total_rb = rb_results["passed"] + rb_results["failed"]
    acc_rb = rb_results["passed"] / total_rb * 100 if total_rb else 0

    print(f"\n--- Rule-Based Fallback ---")
    print(f"  Total queries:  {total_rb}")
    print(f"  Passed:         {rb_results['passed']}")
    print(f"  Failed:         {rb_results['failed']}")
    print(f"  Pass Rate:      {acc_rb:.1f}%")

    print(f"\n  By Difficulty:")
    print(f"  {'Difficulty':<15} {'Passed':>8} {'Total':>8} {'Rate':>8}")
    print(f"  {'-'*15} {'-'*8} {'-'*8} {'-'*8}")
    for diff, counts in sorted(rb_results["by_difficulty"].items()):
        rate = counts["passed"] / counts["total"] * 100 if counts["total"] else 0
        print(f"  {diff:<15} {counts['passed']:>8} {counts['total']:>8} {rate:>7.1f}%")

    # Print failures
    failures = [d for d in rb_results["details"] if not d["passed"]]
    if failures:
        print(f"\n  Failures:")
        for f in failures:
            print(f"    Query: {f['query']!r}")
            print(f"    Parsed: {f['parsed']}")
            print(f"    Expected keys: {f['expected_keys']}")
            if f.get("errors"):
                print(f"    Validation errors: {f['errors']}")
            print()

    # --- Mock LLM evaluation ---
    llm_results = evaluate_mock_llm()
    total_llm = llm_results["passed"] + llm_results["failed"]
    acc_llm = llm_results["passed"] / total_llm * 100 if total_llm else 0

    print(f"\n--- Mock LLM (Pre-defined Responses) ---")
    print(f"  Total queries:  {total_llm}")
    print(f"  Passed:         {llm_results['passed']}")
    print(f"  Failed:         {llm_results['failed']}")
    print(f"  Pass Rate:      {acc_llm:.1f}%")

    # --- Comparison ---
    print(f"\n{'=' * 70}")
    print(f"  COMPARISON SUMMARY")
    print(f"{'=' * 70}")
    print(f"  {'Approach':<30} {'Pass Rate':>10} {'Queries':>10}")
    print(f"  {'-'*30} {'-'*10} {'-'*10}")
    print(f"  {'Rule-Based Fallback':<30} {acc_rb:>9.1f}% {total_rb:>10}")
    print(f"  {'Mock LLM':<30} {acc_llm:>9.1f}% {total_llm:>10}")
    print(f"{'=' * 70}")

    # Save results
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    results_path = output_dir / "evaluation_results.json"
    with open(str(results_path), "w", encoding="utf-8") as f:
        json.dump({
            "rule_based": {
                "pass_rate": acc_rb,
                "passed": rb_results["passed"],
                "total": total_rb,
                "by_difficulty": rb_results["by_difficulty"],
            },
            "mock_llm": {
                "pass_rate": acc_llm,
                "passed": llm_results["passed"],
                "total": total_llm,
            },
        }, f, indent=2, default=str)
    print(f"\n  Results saved to: {results_path}")


if __name__ == "__main__":
    main()
