"""
OCR Benchmark Runner — compares OCR accuracy against ground truth.

Since Tesseract / PaddleOCR may not be installed, this spike:
1. Generates synthetic PDFs with known ground truth (generate_synthetic_docs.py)
2. Simulates OCR output with controlled noise to model realistic error rates
3. Runs field parsers on simulated OCR text to measure end-to-end accuracy
4. Reports per-doc-type, per-field, per-degradation accuracy

In production, swap the simulated OCR for real Tesseract/PaddleOCR calls.
All data is SYNTHETIC.
"""

from __future__ import annotations

import json
import random
import sys
from decimal import Decimal
from pathlib import Path

# Add parent spike for field parsers
sys.path.insert(0, str(Path(__file__).parent.parent / "field_parsers"))

from parsers import parse_amount, parse_date, normalize_bank_name, parse_fdr_number

random.seed(42)

OUTPUT_DIR = Path(__file__).parent / "output"


# ---------------------------------------------------------------------------
# Simulated OCR with controlled noise
# ---------------------------------------------------------------------------

# Character-level OCR error substitutions (common Tesseract mistakes)
_OCR_CONFUSIONS: dict[str, list[str]] = {
    "0": ["O", "o", "0"],
    "1": ["l", "I", "1"],
    "5": ["S", "5"],
    "8": ["B", "8"],
    "6": ["G", "6"],
    "/": ["/", "I", "l"],
    ",": [",", ".", " "],
    ".": [".", ","],
    "₹": ["Rs", "?", ""],
}

# Degradation → error probability per character
_ERROR_RATES: dict[str, float] = {
    "clean": 0.01,
    "rotated_2.5deg": 0.03,
    "blurred": 0.05,
    "low_res": 0.08,
    "stamped": 0.04,
}


def simulate_ocr(text: str, degradation: str = "clean") -> str:
    """Simulate OCR output by introducing character-level noise."""
    error_rate = _ERROR_RATES.get(degradation, 0.02)
    result = []
    for ch in text:
        if random.random() < error_rate and ch in _OCR_CONFUSIONS:
            result.append(random.choice(_OCR_CONFUSIONS[ch]))
        else:
            result.append(ch)
    return "".join(result)


def _format_amount_for_ocr(amount: float) -> str:
    """Format an amount as it would appear on an FDR document."""
    formats = [
        f"Rs. {amount:,.2f}",
        f"INR {amount:,.2f}",
        f"Rs. {amount:,.0f}/-",
        f"₹{amount:,.2f}",
    ]
    return random.choice(formats)


def _format_date_for_ocr(iso_date: str) -> str:
    """Format an ISO date as it would appear on a document."""
    from datetime import date as dt_date
    parts = iso_date.split("-")
    d = dt_date(int(parts[0]), int(parts[1]), int(parts[2]))
    formats = [
        d.strftime("%d/%m/%Y"),
        d.strftime("%d-%m-%Y"),
        d.strftime("%d.%m.%Y"),
        f"{d.day} {d.strftime('%b')} {d.year}",
    ]
    return random.choice(formats)


# ---------------------------------------------------------------------------
# Benchmark logic
# ---------------------------------------------------------------------------

def run_benchmark():
    """Run the OCR benchmark against ground truth."""
    gt_path = OUTPUT_DIR / "ground_truth.json"
    if not gt_path.exists():
        print("Ground truth not found. Run generate_synthetic_docs.py first.")
        sys.exit(1)

    with open(str(gt_path), "r", encoding="utf-8") as f:
        ground_truth = json.load(f)

    results = {
        "by_doc_type": {},
        "by_field": {},
        "by_degradation": {},
        "details": [],
    }

    for doc in ground_truth:
        doc_type = doc["doc_type"]
        variants = doc.get("image_variants", {"clean": ""})

        for degradation in variants:
            # Simulate OCR on each field
            field_results = _benchmark_document(doc, degradation)

            for field_name, (expected, ocr_text, parsed, correct) in field_results.items():
                # Aggregate by doc_type
                key_dt = f"{doc_type}/{field_name}"
                results["by_doc_type"].setdefault(key_dt, {"correct": 0, "total": 0})
                results["by_doc_type"][key_dt]["total"] += 1
                if correct:
                    results["by_doc_type"][key_dt]["correct"] += 1

                # Aggregate by field
                results["by_field"].setdefault(field_name, {"correct": 0, "total": 0})
                results["by_field"][field_name]["total"] += 1
                if correct:
                    results["by_field"][field_name]["correct"] += 1

                # Aggregate by degradation
                results["by_degradation"].setdefault(degradation, {"correct": 0, "total": 0})
                results["by_degradation"][degradation]["total"] += 1
                if correct:
                    results["by_degradation"][degradation]["correct"] += 1

                results["details"].append({
                    "doc_id": doc["doc_id"],
                    "doc_type": doc_type,
                    "degradation": degradation,
                    "field": field_name,
                    "expected": str(expected),
                    "ocr_text": ocr_text,
                    "parsed": str(parsed),
                    "correct": correct,
                })

    _print_report(results)
    _save_report(results)
    return results


def _benchmark_document(doc: dict, degradation: str) -> dict:
    """Benchmark OCR + parsing for a single document variant."""
    field_results = {}

    # Amount field
    if "amount" in doc:
        expected = doc["amount"]
        raw = _format_amount_for_ocr(expected)
        ocr_text = simulate_ocr(raw, degradation)
        parsed = parse_amount(ocr_text)
        correct = parsed is not None and abs(float(parsed) - expected) < 1.0
        field_results["amount"] = (expected, ocr_text, parsed, correct)

    # Bank name
    if "bank" in doc:
        expected = doc["bank"]
        # Sometimes OCR sees abbreviation, sometimes full name
        raw = random.choice([expected, expected.upper()])
        ocr_text = simulate_ocr(raw, degradation)
        parsed = normalize_bank_name(ocr_text)
        correct = parsed == expected
        field_results["bank_name"] = (expected, ocr_text, parsed, correct)

    # FDR number
    if "fdr_number" in doc:
        expected = doc["fdr_number"]
        raw = f"FDR No: {expected}"
        ocr_text = simulate_ocr(raw, degradation)
        parsed = parse_fdr_number(ocr_text)
        correct = parsed == expected
        field_results["fdr_number"] = (expected, ocr_text, parsed, correct)

    # Issue/deposit date
    date_key = "issue_date" if "issue_date" in doc else "deposit_date" if "deposit_date" in doc else "doc_date"
    if date_key in doc:
        expected = doc[date_key]
        raw = _format_date_for_ocr(expected)
        ocr_text = simulate_ocr(raw, degradation)
        parsed = parse_date(ocr_text)
        correct = parsed is not None and parsed.isoformat() == expected
        field_results["date"] = (expected, ocr_text, parsed, correct)

    return field_results


def _print_report(results: dict):
    """Print benchmark results to console."""
    print("\n" + "=" * 70)
    print("  OCR BENCHMARK RESULTS (SYNTHETIC DATA)")
    print("=" * 70)

    # By field
    print("\n--- Accuracy by Field ---")
    print(f"  {'Field':<20} {'Correct':>8} {'Total':>8} {'Accuracy':>10}")
    print(f"  {'-'*20} {'-'*8} {'-'*8} {'-'*10}")
    for field, counts in sorted(results["by_field"].items()):
        acc = counts["correct"] / counts["total"] * 100 if counts["total"] else 0
        print(f"  {field:<20} {counts['correct']:>8} {counts['total']:>8} {acc:>9.1f}%")

    # By degradation
    print("\n--- Accuracy by Degradation Level ---")
    print(f"  {'Degradation':<20} {'Correct':>8} {'Total':>8} {'Accuracy':>10}")
    print(f"  {'-'*20} {'-'*8} {'-'*8} {'-'*10}")
    for deg, counts in sorted(results["by_degradation"].items()):
        acc = counts["correct"] / counts["total"] * 100 if counts["total"] else 0
        print(f"  {deg:<20} {counts['correct']:>8} {counts['total']:>8} {acc:>9.1f}%")

    # By doc_type/field
    print("\n--- Accuracy by Document Type / Field ---")
    print(f"  {'DocType/Field':<35} {'Correct':>8} {'Total':>8} {'Accuracy':>10}")
    print(f"  {'-'*35} {'-'*8} {'-'*8} {'-'*10}")
    for key, counts in sorted(results["by_doc_type"].items()):
        acc = counts["correct"] / counts["total"] * 100 if counts["total"] else 0
        print(f"  {key:<35} {counts['correct']:>8} {counts['total']:>8} {acc:>9.1f}%")

    # Overall
    total_correct = sum(c["correct"] for c in results["by_field"].values())
    total_all = sum(c["total"] for c in results["by_field"].values())
    overall = total_correct / total_all * 100 if total_all else 0
    print(f"\n  OVERALL: {total_correct}/{total_all} = {overall:.1f}%")
    print("=" * 70)


def _save_report(results: dict):
    """Save detailed results to JSON."""
    report_path = OUTPUT_DIR / "benchmark_results.json"
    # Don't save huge details list to keep file manageable
    summary = {k: v for k, v in results.items() if k != "details"}
    summary["total_evaluations"] = len(results["details"])
    summary["failures"] = [d for d in results["details"] if not d["correct"]]

    with open(str(report_path), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"\n  Detailed results saved to: {report_path}")


if __name__ == "__main__":
    run_benchmark()
