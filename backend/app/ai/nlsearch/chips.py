"""Human-readable chip generation from parsed InstrumentFilter."""

from __future__ import annotations


def generate_chips(parsed_filter: dict) -> list[str]:
    """Convert a parsed InstrumentFilter dict to human-readable display chips.

    Each chip is a short, user-friendly description of one filter condition.
    """
    chips: list[str] = []

    if "statuses" in parsed_filter:
        statuses = parsed_filter["statuses"]
        if isinstance(statuses, list):
            chips.append(f"Status: {', '.join(statuses)}")

    if "verification_tag" in parsed_filter:
        tag = parsed_filter["verification_tag"]
        label = "Bank Verified" if tag == "BANK_VERIFIED" else "Self Declared"
        chips.append(f"Verification: {label}")

    if "banks" in parsed_filter:
        banks = parsed_filter["banks"]
        if isinstance(banks, list):
            chips.append(f"Bank: {', '.join(banks)}")

    if "states" in parsed_filter:
        states = parsed_filter["states"]
        if isinstance(states, list):
            chips.append(f"State: {', '.join(states)}")

    if "amount_min" in parsed_filter:
        chips.append(f"Amount >= Rs.{_format_amount(parsed_filter['amount_min'])}")

    if "amount_max" in parsed_filter:
        chips.append(f"Amount <= Rs.{_format_amount(parsed_filter['amount_max'])}")

    if "maturity_from" in parsed_filter:
        chips.append(f"Maturity from {parsed_filter['maturity_from']}")

    if "maturity_to" in parsed_filter:
        chips.append(f"Maturity to {parsed_filter['maturity_to']}")

    if "issue_from" in parsed_filter:
        chips.append(f"Issued from {parsed_filter['issue_from']}")

    if "issue_to" in parsed_filter:
        chips.append(f"Issued to {parsed_filter['issue_to']}")

    if parsed_filter.get("has_missing_documents"):
        chips.append("Missing documents")

    if parsed_filter.get("has_open_alerts"):
        chips.append("Has open alerts")

    if "escalation_level_min" in parsed_filter:
        chips.append(f"Escalation >= {parsed_filter['escalation_level_min']}")

    if "text" in parsed_filter:
        chips.append(f"Search: \"{parsed_filter['text']}\"")

    if "sort_by" in parsed_filter:
        direction = parsed_filter.get("sort_dir", "desc")
        arrow = "highest first" if direction == "desc" else "lowest first"
        chips.append(f"Sort by {parsed_filter['sort_by']} ({arrow})")

    return chips


def _format_amount(amount: float | int) -> str:
    """Format amount in Indian notation."""
    if amount >= 10_000_000:
        return f"{amount / 10_000_000:.1f} Crore"
    elif amount >= 100_000:
        return f"{amount / 100_000:.1f} Lakh"
    else:
        return f"{amount:,.0f}"
