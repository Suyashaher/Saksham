# Spike: Approval-Time Prediction

> **Status**: COMPLETE — 3 models trained, HistGradientBoosting best for verification, RandomForest best for release
> **ALL DATA AND METRICS ARE SYNTHETIC** — not real-world performance

## Purpose

Validate feasibility of predicting approval turnaround times using features
available in the AICTE FDR portal's existing database schema. Establishes
baselines and identifies the most important predictive features.

## Methodology

1. **Generate** 3,000 synthetic historical cases with realistic feature
   distributions matching Indian educational institution FDR patterns.
2. **Train** 3 models: Median Baseline, RandomForest, HistGradientBoosting.
3. **Evaluate** on 20% hold-out test set (600 cases).
4. **Report** MAE, Median Absolute Error, RMSE, and 80% interval coverage.

## Results

### Verification Turnaround (days from submission to verification)

| Model | MAE | MedAE | RMSE |
|---|---|---|---|
| Median Baseline | 4.116 | 3.300 | 5.402 |
| RandomForest | 1.654 | 1.459 | 2.090 |
| **HistGradientBoosting** | **1.625** | **1.380** | **2.051** |

80% Prediction Interval Coverage: **56.3%** (RandomForest quantiles)

Top 5 Features:
1. `escalation_level` — 84.1%
2. `amount` — 4.4%
3. `verification_method` — 2.5%
4. `doc_completeness` — 1.6%
5. `submission_dow` — 1.4%

### Release Turnaround (days from release request to release)

| Model | MAE | MedAE | RMSE |
|---|---|---|---|
| Median Baseline | 2.041 | 1.625 | 2.597 |
| **RandomForest** | **1.719** | **1.436** | **2.157** |
| HistGradientBoosting | 1.781 | 1.536 | 2.212 |

80% Prediction Interval Coverage: **58.8%** (RandomForest quantiles)

Top 5 Features:
1. `escalation_level` — 48.6%
2. `amount` — 14.6%
3. `state` — 7.6%
4. `bank` — 6.1%
5. `submission_dow` — 5.4%

## Key Findings

1. **ML models significantly outperform the median baseline** — 60% lower MAE
   for verification turnaround, demonstrating predictive value in available features.

2. **Escalation level dominates** — expected since escalation is directly correlated
   with turnaround time in the synthetic data (and likely in reality). In production,
   removing this circular feature and using only pre-decision features will lower
   accuracy but give more useful predictions.

3. **Prediction intervals need calibration** — 56-59% coverage for an 80% target
   suggests the intervals are too narrow. Production should use conformal
   prediction or wider quantiles (5th-95th percentile instead of 10th-90th).

4. **Release turnaround is harder to predict** — lower improvement over baseline
   because it has less variance and depends more on human factors.

5. **Both models are fast** — training completes in <1 second on 3K cases.
   Production retraining can run as a weekly Celery task.

## Synthetic Data Characteristics

| Feature | Distribution |
|---|---|
| States | 15 Indian states, uniform |
| Banks | 10 major Indian banks, uniform |
| Amounts | Rs. 25K to Rs. 5 crore (4 buckets) |
| Verification methods | API (40%), QR (30%), LETTER (30%) |
| Document completeness | Complete (70%), Missing 1 (20%), Missing multiple (10%) |
| Alerts | 15% have alerts |
| Renewals | 25% are renewals |
| Random seed | 42 |

## Running

```bash
cd spikes/time_prediction
pip install -r requirements.txt
python generate_synthetic_data.py   # generates 3K cases in output/
python train_models.py              # trains models, prints comparison
```

## Files

- `generate_synthetic_data.py` — Synthetic data generator (3,000 cases)
- `train_models.py` — Model training and evaluation
- `requirements.txt` — Pinned dependencies
- `output/` — Generated data and model comparison results
