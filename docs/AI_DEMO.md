# AI Features Demo Guide — Phase 7B

> **Prerequisites**: Backend running (`uvicorn app.main:app`), valid JWT token
> **Base URL**: `http://localhost:8000`

---

## 0. Check AI Configuration

```bash
curl http://localhost:8000/api/v1/ai/config | python -m json.tool
```

Expected response shows all feature flags and data source labels.

---

## 1. OCR Autofill — Preview Mode

Upload a PDF/image and get extracted fields without storing anything:

```bash
curl -X POST http://localhost:8000/api/v1/ai/ocr/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_fdr.pdf" \
  -F "doc_type=FDR_SCAN" \
  | python -m json.tool
```

**Response**: Extracted fields with per-field confidence scores.

---

## 2. OCR Cross-Check — Attach Mode

Run OCR on an already-uploaded document and compare with declared values:

```bash
curl -X POST http://localhost:8000/api/v1/ai/ocr/extract/{document_id} \
  -H "Authorization: Bearer $TOKEN" \
  | python -m json.tool
```

**Response**: Fields + mismatches (recorded as WARNING validation flags).

---

## 3. Trust Score

Get the transparent trust score for an instrument:

```bash
curl http://localhost:8000/api/v1/instruments/{instrument_id}/trust-score?recompute=true \
  -H "Authorization: Bearer $TOKEN" \
  | python -m json.tool
```

**Response**: Score (0-100), band (HIGH/MEDIUM/LOW), per-factor breakdown
with human-readable reasons.

---

## 4. Approval-Time Prediction

Get predicted turnaround times:

```bash
curl http://localhost:8000/api/v1/instruments/{instrument_id}/predicted-time \
  -H "Authorization: Bearer $TOKEN" \
  | python -m json.tool
```

**Response**: Verification and release predictions with confidence intervals.
Note: `is_heuristic: true` means no trained model is available — using
rule-based estimates.

---

## 5. Natural Language Search

Search instruments using plain English or Hinglish:

```bash
curl -X POST http://localhost:8000/api/v1/instruments/nl-search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SBI FDRs above 5 lakh in Maharashtra"}' \
  | python -m json.tool
```

**More examples**:
```bash
# Hinglish
-d '{"query": "HDFC ke pending review waale FDR"}'

# Status + sort
-d '{"query": "show all released FDRs sorted by highest amount"}'

# Date range
-d '{"query": "instruments maturing in next 30 days"}'

# Missing docs
-d '{"query": "instruments with missing documents"}'
```

**Response**: Parsed filter, human-readable chips, method used (llm/rule_based),
and matching instruments.

---

## 6. Submit Feedback

Provide corrections on AI outputs:

```bash
curl -X POST http://localhost:8000/api/v1/ai/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ai_feature": "trust_score",
    "entity_id": "{instrument_id}",
    "officer_verdict": "INCORRECT",
    "verdict_detail": "too_high",
    "correction": {"expected_band": "LOW"}
  }' \
  | python -m json.tool
```

---

## 7. Admin — View Feedback Stats

```bash
curl http://localhost:8000/api/v1/ai/feedback/stats?window_days=30 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python -m json.tool
```

---

## 8. Admin — Manage Trust Score Weights

List weight versions:
```bash
curl http://localhost:8000/api/v1/ai/weights \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Update weights (creates new version):
```bash
curl -X PUT http://localhost:8000/api/v1/ai/weights \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"document_completeness": 25, "ocr_match": 15, "bank_verification": 20, "amount_reasonableness": 10, "date_consistency": 10, "alert_count": 5, "cross_doc_consistency": 5, "renewal_chain_integrity": 5, "response_timeliness": 3, "bank_reputation": 2}'
```

---

## 9. Admin — Manage ML Models

List registered models:
```bash
curl http://localhost:8000/api/v1/ai/models \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Promote a model to production:
```bash
curl -X POST http://localhost:8000/api/v1/ai/models/{model_id}/promote \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 10. Frontend UI Click-Paths (Phase 7C)

### A. Document OCR Auto-Fill (Institution & Officer)
1. Navigate to **Submit New FDR** (`/instruments/new`) or open the **Renew FDR** modal.
2. In Step 1, click the purple **Auto-fill from Document** button.
3. Select your document category (`FDR_SCAN`, `DEPOSIT_CONFIRMATION`, or `BANK_LETTER`).
4. Choose a PDF/JPG/PNG file (under 5 MB) and click **Extract with OCR**.
5. Inspect the side-by-side review panel: check confidence bars, verify highlighted values, and toggle checkboxes.
6. Click **Apply Selected Fields** to fill form inputs automatically. Review manually and submit.

### B. Transparent Trust Score & AI Insights (Officer & Admin)
1. Navigate to the **Scrutiny Queue** (`/officer/queue`).
2. Observe the **AI Trust Score** column with color-coded badges and risk bands (`Low risk`, `Needs review`, `High priority`).
3. Hover over any score badge to view the popover detailing top contributing factors, weights schema version, and data source.
4. Click on an instrument to open **Instrument Detail** (`/instruments/:id`).
5. Select the **AI Risk & Insights** tab to view the interactive score gauge and full 10-factor mathematical breakdown table.

### C. Approval-Time Prediction (Officer & Approver)
1. On the **Scrutiny Queue** or **Scrutiny Console** (`/officer/scrutiny/:id`), locate the **Est. Resolution** chip.
2. View point estimates (e.g. `~4.2 days`) and 80% confidence interval ranges (`2.5-6.8d`).
3. If an instrument is nearing or past maturity, observe the distinct red **At risk** warning tag.
4. Hover to view the factors driving turnaround latency and the `Synthetic data` provenance badge.

### D. Natural Language Search with Editable Filter Chips
1. Navigate to **Search Instruments** (`/officer/search`).
2. Type a plain-language query into the AI search bar, e.g.:
   `show FDRs maturing next month above ₹5 lakh from Maharashtra`
3. Hit Enter. View the parsed criteria rendered as editable purple chips.
4. Note the engine indicator (`Interpreted by: AI (Gemini)` or `Interpreted by: Rules`).
5. Click the **×** on any chip to relax criteria; the search immediately executes a structured query without re-invoking the LLM.
6. Rate the interpretation with the thumbs up/down feedback widget.

### E. Document Mismatch & OCR Verification Flags
1. Open an instrument in the **Scrutiny Console** (`/officer/scrutiny/:id`) or the **Documents** tab of **Instrument Detail**.
2. Notice the yellow warning banners for `OCR_MISMATCH`, `CROSS_DOC_MISMATCH`, or `DOC_TYPE_SUSPECT`.
3. Compare declared vs. OCR extracted values side-by-side.
4. Submit feedback on flag accuracy (`Correct flag` / `False alarm`) to help improve precision.

### F. Admin AI Governance Console
1. Log in as an administrator and expand the **AI & Governance** sidebar category.
2. **Trust Weights** (`/admin/ai/weights`): Inspect historical policy versions. Click **Create New Weight Version** to open the interactive slider editor. Ensure weights sum to 100 points, preview impact, and confirm activation.
3. **Model Registry** (`/admin/ai/models`): Inspect registered model artifacts, holdout metrics (MAE, RMSE), and deployment stages (`Champion`, `Challenger`). Promote challengers or rollback versions via confirm dialogs.
4. **AI Health** (`/admin/ai/health`): Review rolling officer agreement rates and reward metrics (-1.0 to +1.0) rendered as accessible Recharts bars and data tables across 7d, 30d, and 90d windows.
5. **Feedback Logs** (`/admin/ai/feedback`): Inspect raw feedback volumes and officer acceptance rates across all AI subsystems.

---

## Notes

- All predictions trained on **synthetic data** — real-world accuracy will differ
- OCR requires Tesseract 5+ installed. If unavailable, endpoints return 503
- NL Search works without Gemini API key (uses rule-based parser as fallback)
- All AI features are advisory-only — no AI output can change instrument status
