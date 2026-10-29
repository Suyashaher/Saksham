"""
Synthetic Data Generator for Approval-Time Prediction Spike.

Generates 3,000 synthetic historical instrument cases with realistic
feature distributions matching the AICTE FDR portal's data model.

ALL DATA IS SYNTHETIC — generated for spike/feasibility testing only.
Random seed is fixed for reproducibility.
"""

from __future__ import annotations

import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

# Fixed random seed for reproducibility
random.seed(42)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

N_CASES = 3000

# ---------------------------------------------------------------------------
# Feature distributions (realistic for Indian educational institutions)
# ---------------------------------------------------------------------------

STATES = [
    "Delhi", "Maharashtra", "Tamil Nadu", "Karnataka", "Uttar Pradesh",
    "West Bengal", "Rajasthan", "Gujarat", "Madhya Pradesh", "Kerala",
    "Andhra Pradesh", "Telangana", "Bihar", "Punjab", "Haryana",
]

BANKS = [
    "State Bank of India", "Punjab National Bank", "Bank of Baroda",
    "Canara Bank", "HDFC Bank", "ICICI Bank", "Union Bank of India",
    "Indian Overseas Bank", "Axis Bank", "Kotak Mahindra Bank",
]

# Verification methods affect turnaround differently
VERIFICATION_METHODS = ["API", "QR", "LETTER"]
VERIFICATION_WEIGHTS = [0.4, 0.3, 0.3]  # API is fastest

# Document completeness categories
DOC_COMPLETENESS = ["complete", "missing_one", "missing_multiple"]
DOC_COMPLETENESS_WEIGHTS = [0.7, 0.2, 0.1]

# Officer workload levels
OFFICER_WORKLOAD_LEVELS = ["low", "medium", "high"]
OFFICER_WORKLOAD_WEIGHTS = [0.3, 0.5, 0.2]


def _generate_base_turnaround(
    verification_method: str,
    doc_completeness: str,
    amount_bucket: str,
    officer_workload: str,
    has_alerts: bool,
    state: str,
) -> float:
    """Generate a realistic base turnaround time in days."""
    # Base times by verification method (days)
    base = {
        "API": random.gauss(2, 0.8),
        "QR": random.gauss(4, 1.5),
        "LETTER": random.gauss(8, 3.0),
    }[verification_method]

    # Document completeness penalty
    doc_penalty = {
        "complete": 0,
        "missing_one": random.gauss(3, 1),
        "missing_multiple": random.gauss(7, 2),
    }[doc_completeness]

    # Amount-based scrutiny delay
    amount_delay = {
        "small": 0,        # < 5 lakh
        "medium": random.gauss(1, 0.5),  # 5-25 lakh
        "large": random.gauss(3, 1),     # 25-100 lakh
        "very_large": random.gauss(5, 2), # > 1 crore
    }[amount_bucket]

    # Officer workload
    workload_delay = {
        "low": 0,
        "medium": random.gauss(1, 0.5),
        "high": random.gauss(3, 1.5),
    }[officer_workload]

    # Alerts add delay
    alert_delay = random.gauss(2, 1) if has_alerts else 0

    # State-specific processing (some states are faster)
    state_factor = {
        "Delhi": 0.8,
        "Maharashtra": 0.9,
        "Tamil Nadu": 0.85,
        "Karnataka": 0.9,
        "Kerala": 0.85,
    }.get(state, 1.0)

    total = (base + doc_penalty + amount_delay + workload_delay + alert_delay) * state_factor

    # Floor at 0.5 days, cap at 45 days
    return max(0.5, min(45, total))


def _amount_bucket(amount: float) -> str:
    if amount < 500000:
        return "small"
    elif amount < 2500000:
        return "medium"
    elif amount < 10000000:
        return "large"
    else:
        return "very_large"


def generate_dataset() -> list[dict]:
    """Generate synthetic dataset of historical instrument cases."""
    cases = []

    for i in range(N_CASES):
        state = random.choice(STATES)
        bank = random.choice(BANKS)
        verification_method = random.choices(VERIFICATION_METHODS, VERIFICATION_WEIGHTS)[0]
        doc_completeness = random.choices(DOC_COMPLETENESS, DOC_COMPLETENESS_WEIGHTS)[0]
        officer_workload = random.choices(OFFICER_WORKLOAD_LEVELS, OFFICER_WORKLOAD_WEIGHTS)[0]

        # Amount (Indian FDR amounts typically 25K to 5 crore)
        amount = random.choice([
            random.uniform(25000, 500000),       # small
            random.uniform(500000, 2500000),     # medium
            random.uniform(2500000, 10000000),   # large
            random.uniform(10000000, 50000000),  # very large
        ])

        amount_bkt = _amount_bucket(amount)
        has_alerts = random.random() < 0.15  # 15% have alerts
        n_alerts = random.randint(1, 3) if has_alerts else 0

        # Whether this is a renewal
        is_renewal = random.random() < 0.25

        # Number of documents uploaded
        n_docs = {"complete": 2, "missing_one": 1, "missing_multiple": 0}[doc_completeness]
        if random.random() < 0.3:
            n_docs += 1  # extra supporting docs

        # Tenure in months
        tenure_months = random.choice([6, 12, 18, 24, 36, 60])

        # Generate submission date (spread over 2 years)
        submission_date = date(2024, 1, 1) + timedelta(days=random.randint(0, 730))

        # Day of week effect (submissions on Friday take longer)
        dow = submission_date.weekday()

        # --- Target: verification turnaround (days) ---
        verification_days = _generate_base_turnaround(
            verification_method, doc_completeness, amount_bkt,
            officer_workload, has_alerts, state,
        )

        # Weekend/holiday effect
        if dow >= 4:  # Friday or weekend
            verification_days *= 1.3

        # --- Target: release turnaround (days from release request) ---
        release_days = random.gauss(5, 2) + (verification_days * 0.3)
        release_days = max(1, min(30, release_days))

        # Escalation level
        escalation_level = 0
        if verification_days > 10:
            escalation_level = 1
        if verification_days > 20:
            escalation_level = 2

        cases.append({
            "case_id": i + 1,
            "state": state,
            "bank": bank,
            "amount": round(amount, 2),
            "amount_bucket": amount_bkt,
            "tenure_months": tenure_months,
            "verification_method": verification_method,
            "doc_completeness": doc_completeness,
            "n_documents": n_docs,
            "officer_workload": officer_workload,
            "has_alerts": has_alerts,
            "n_alerts": n_alerts,
            "is_renewal": is_renewal,
            "submission_dow": dow,
            "escalation_level": escalation_level,
            "submission_date": submission_date.isoformat(),
            # Targets
            "verification_turnaround_days": round(verification_days, 2),
            "release_turnaround_days": round(release_days, 2),
        })

    return cases


def save_dataset(cases: list[dict]):
    """Save dataset to CSV and JSON."""
    # CSV
    csv_path = OUTPUT_DIR / "synthetic_cases.csv"
    keys = cases[0].keys()
    with open(str(csv_path), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(cases)

    # JSON
    json_path = OUTPUT_DIR / "synthetic_cases.json"
    with open(str(json_path), "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=2)

    # Stats
    ver_days = [c["verification_turnaround_days"] for c in cases]
    rel_days = [c["release_turnaround_days"] for c in cases]

    print(f"Generated {len(cases)} synthetic cases")
    print(f"  CSV: {csv_path}")
    print(f"  JSON: {json_path}")
    print(f"\n  Verification turnaround (days):")
    print(f"    Mean:   {sum(ver_days)/len(ver_days):.2f}")
    print(f"    Median: {sorted(ver_days)[len(ver_days)//2]:.2f}")
    print(f"    Min:    {min(ver_days):.2f}")
    print(f"    Max:    {max(ver_days):.2f}")
    print(f"\n  Release turnaround (days):")
    print(f"    Mean:   {sum(rel_days)/len(rel_days):.2f}")
    print(f"    Median: {sorted(rel_days)[len(rel_days)//2]:.2f}")
    print(f"    Min:    {min(rel_days):.2f}")
    print(f"    Max:    {max(rel_days):.2f}")


if __name__ == "__main__":
    cases = generate_dataset()
    save_dataset(cases)
