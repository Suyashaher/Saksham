# Operational Impact Metrics Documentation

This document defines the mathematical formulas, regulatory rationale, and aggregation logic behind the operational metrics exposed via `GET /dashboard/impact-metrics`.

---

## 1. Average & Median Verification Turnaround
- **Definition**: The elapsed time (in calendar days) from initial instrument submission by an institution to the first decisive scrutiny action (either activation upon verified scrutiny or flagging of a discrepancy).
- **Formula**:
  $$\text{Turnaround} = \text{Date}(\text{InstrumentStatusHistory.changed\_at}) - \text{Date}(\text{Instrument.created\_at})$$
  $$\text{Average Verification Turnaround} = \frac{1}{N} \sum_{i=1}^N \text{Turnaround}_i$$
- **Target Statuses**: `InstrumentStatusHistory.to_status` $\in$ `{ACTIVE, DISCREPANCY}` originating from `{SUBMITTED, UNDER_SCRUTINY}`.
- **Unit**: Days (rounded to 1 decimal place).

---

## 2. Average Release Turnaround
- **Definition**: The duration between when an institution raises a release or refund request and when the approving authority approves the release and issues the closure certificate.
- **Formula**:
  $$\text{Release Turnaround} = \text{Date}(\text{ReleaseRequest.decided\_at}) - \text{Date}(\text{ReleaseRequest.created\_at})$$
  $$\text{Average Release Turnaround} = \frac{1}{M} \sum_{j=1}^M \text{Release Turnaround}_j$$
- **Target Requests**: `ReleaseRequest.status == CLOSED` with a valid `closure_document_id`.
- **Unit**: Days (rounded to 1 decimal place).

---

## 3. Percentage of Renewals Completed Before Maturity
- **Definition**: The proportion of replaced FDR instruments where the renewing instrument was submitted on or before the maturity date of the antecedent instrument.
- **Formula**:
  $$\text{On-Time Renewal} = \begin{cases} 1 & \text{if } \text{Date}(\text{NewInstrument.created\_at}) \le \text{OldInstrument.maturity\_date} \\ 0 & \text{otherwise} \end{cases}$$
  $$\% \text{ Renewals Before Maturity} = \left( \frac{\sum \text{On-Time Renewal}}{\text{Total Replaced Instruments}} \right) \times 100$$
- **Significance**: Assesses institutional compliance and prevents lapses in security deposit continuity.

---

## 4. Cumulative Operational Counts
- **Alerts Auto-Sent (`alerts_auto_sent_count`)**:
  $$\text{Count of } \text{Alerts} \text{ where } \text{status} = \text{SENT}$$
- **Alerts Auto-Resolved (`alerts_auto_resolved_count`)**:
  $$\text{Count of } \text{Alerts} \text{ where } \text{resolved} = \text{True}$$
- **Validation Flags Caught (`validation_flags_caught_count`)**:
  $$\text{Count of } \text{Instruments} \text{ where } \text{validation\_flags} \text{ is not NULL}$$
- **Discrepancies Identified (`discrepancies_found_count`)**:
  $$\text{Count of } \text{ScrutinyObservations} \text{ where } \text{category} = \text{'DISCREPANCY'}$$
