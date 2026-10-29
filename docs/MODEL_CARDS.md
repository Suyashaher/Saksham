# AI Model Cards — AICTE FDR Portal (Phase 7B)

> **Document version**: 1.0
> **Date**: 2026-10-27
> **Status**: All models trained on SYNTHETIC DATA

---

## Model 1: Time Prediction — Verification Turnaround

| Field | Value |
|---|---|
| **Model name** | `time_prediction_verification` |
| **Algorithm** | HistGradientBoostingRegressor |
| **Framework** | scikit-learn 1.6.1 |
| **Python** | 3.14 |
| **Data source** | ⚠️ **SYNTHETIC** (seed=42, 3,000 cases) |
| **Training date** | 2026-10-27 |
| **Version** | v1-synthetic |

### Metrics (on synthetic hold-out set)

| Metric | Value |
|---|---|
| MAE | 1.625 days |
| Median AE | 1.380 days |
| RMSE | 2.051 days |

### Features (12 inputs)

`amount`, `amount_bucket`, `tenure_months`, `bank`, `state`,
`n_documents`, `doc_completeness`, `n_alerts`, `is_renewal`,
`submission_dow`, `officer_workload`, `verification_method`

> [!WARNING]
> `escalation_level` is **excluded** due to target leakage risk.

### Limitations

- Trained entirely on synthetic data — real-world performance will differ
- Synthetic data assumes API verification is faster than LETTER (reasonable but unvalidated)
- Retrain on real data as it accumulates (100+ cases minimum)

### Intended Use

Advisory-only predictions shown to officers and institutions.
Predictions CANNOT change priorities, bypass queues, or trigger escalation.

---

## Model 2: Time Prediction — Release Turnaround

| Field | Value |
|---|---|
| **Model name** | `time_prediction_release` |
| **Algorithm** | RandomForestRegressor |
| **Framework** | scikit-learn 1.6.1 |
| **Data source** | ⚠️ **SYNTHETIC** (seed=42, 3,000 cases) |
| **Version** | v1-synthetic |

### Metrics (on synthetic hold-out set)

| Metric | Value |
|---|---|
| MAE | 1.719 days |
| Median AE | 1.436 days |
| RMSE | 2.157 days |

### Prediction Intervals

Uses per-tree quantile estimation (10th–90th percentile).
Spike showed 56-59% coverage for 80% target — needs calibration
via conformal prediction (planned for Phase 7C).

### Limitations

Same as Model 1 — all synthetic data caveats apply.

---

## Model 3: Trust Score — Rule-Based (v1.0)

| Field | Value |
|---|---|
| **Model name** | `trust_score` |
| **Algorithm** | Weighted rule-based scoring (NOT a black-box ML model) |
| **Version** | v1.0-rule-based |
| **Data source** | Rule-based (no training data) |

### Factors (10 total, weights sum to 100)

| # | Factor | Weight | Source |
|---|---|---|---|
| 1 | Document completeness | 20 | `DocumentRegistry.get_required_doc_types(itype)` vs uploaded docs |
| 2 | OCR vs declared match | 15 | `ocr_runs.mismatch_count` |
| 3 | Bank verification | 20 | `verification_tag` + method |
| 4 | Amount reasonableness | 10 | vs institutional average |
| 5 | Date consistency | 10 | issue_date < maturity_date, tenure >= 30d, BG claim period |
| 6 | Alert count | 10 | open alerts |
| 7 | Cross-document consistency | 5 | FDR (FDR_SCAN vs DEPOSIT_CONFIRMATION), BG (BANK_GUARANTEE_DOCUMENT vs BANK_LETTER) |
| 8 | Renewal chain integrity | 5 | `replaces_instrument_id` links |
| 9 | Response timeliness | 3 | days in DISCREPANCY status |
| 10 | Bank reputation | 2 | scheduled vs co-op vs unknown |

### Bands

| Band | Range | Action |
|---|---|---|
| HIGH | 80-100 | Routine approval |
| MEDIUM | 50-79 | Closer review recommended |
| LOW | 0-49 | Detailed scrutiny required |

### Weight Tuning

Weights are stored in `trust_score_weights` table (versioned, admin-editable).
When 100+ officer feedback labels accumulate, logistic regression can suggest
adjusted weights — admin must manually approve any change.

### Limitations

- Rule-based, not learned from data — weights are expert-set defaults
- Amount "reasonableness" baseline requires multiple instruments per institution
- Response timeliness only applies to instruments that have been in DISCREPANCY
