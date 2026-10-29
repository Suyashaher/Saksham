# Phase 4 Demo & Timeline Guide

This guide describes how to run and demonstrate the automated validity/maturity tracking, alert generation, escalation, and renewal monitoring in the **AICTE FDR Management Portal**.

---

## 1. Seeded Timeline Instruments

The Phase 4 seed script (`python -m app.scripts.seed_phase4`) seeds 7 sample instruments for Delhi Technological University (`1-DTU-DELHI`) positioned across key milestone windows relative to `today`:

| Reference Number | Maturity Offset | Initial Status | Purpose / Milestone |
|---|---|---|---|
| `DEMO-100D` | +100 days | `ACTIVE` | Outside the 90-day alert window (remains ACTIVE, no alert) |
| `DEMO-85D` | +85 days | `ACTIVE` | Enters the 90-day window (transitions to `EXPIRING`, triggers 90d reminder) |
| `DEMO-45D` | +45 days | `EXPIRING` | Within 60-day window (triggers 60d reminder) |
| `DEMO-20D` | +20 days | `EXPIRING` | Within 30-day window (triggers 30d reminder) |
| `DEMO-5D` | +5 days | `EXPIRING` | Within 7-day critical window (triggers 7d urgent email + SMS) |
| `DEMO-OVR2` | -2 days | `MATURED` | Passed maturity date 2 days ago (triggers overdue alert) |
| `DEMO-OVR10` | -10 days | `MATURED` | Passed maturity date 10 days ago (past 7-day threshold, triggers Level 1 escalation) |

---

## 2. Seed Default Alert Rules

The default rules seeded into `alert_rules` table:

1. **Maturity Reminder 90 Days (Institution)**: EMAIL, IN_APP
2. **Maturity Reminder 60 Days (Institution)**: EMAIL, IN_APP
3. **Maturity Reminder 30 Days (Institution)**: EMAIL, IN_APP
4. **Maturity Reminder 7 Days (Institution)**: EMAIL, SMS, IN_APP
5. **Maturity Notice 90 Days (Officer)**: EMAIL to Verifying Officer
6. **Maturity Notice 30 Days (Officer)**: EMAIL to Verifying Officer
7. **Overdue Matured Instrument (Immediate)**: EMAIL, SMS, IN_APP to Institution; escalates after 7 days
8. **Stale Scrutiny / Verification (30 Days)**: EMAIL to Officer; escalates after 14 days
9. **Unresolved Discrepancy (14 Days)**: EMAIL, IN_APP to Institution; escalates after 7 days

---

## 3. Running the Demo via Docker Compose

### Step 1: Start Services
```bash
docker compose up -d
```
Services started:
- `postgres:16` (port 5432)
- `redis:7` (port 6379)
- `minio` (ports 9000, 9001)
- `mailhog` (port 1025 for SMTP, port 8025 for Web UI)
- `backend` (port 8000)
- `celery_worker` (background task execution)
- `celery_beat` (periodic task scheduler: 02:00 IST daily scan, 5-min alert dispatcher)

### Step 2: Run Database Migrations & Seeds
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed_users
docker compose exec backend python -m app.scripts.seed_bank_registry
docker compose exec backend python -m app.scripts.seed_phase4
```

### Step 3: Trigger Daily Scan via Admin API
Log in as Admin (`admin@aicte.gov.in` / `Admin@AICTE2026!`), get JWT token, and call:

```bash
curl -X POST "http://localhost:8000/admin/jobs/run-daily-scan" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'
```

Output:
```json
{
  "as_of": "2026-10-27",
  "dry_run": false,
  "transitioned_expiring": 1,
  "transitioned_matured": 0,
  "alerts_created": 7
}
```
Notice:
- `DEMO-85D` transitioned from `ACTIVE` to `EXPIRING`.
- Alerts were created for the eligible maturity rules and overdue rules.
- Re-running the command produces `"alerts_created": 0` (strict idempotency).

### Step 4: Demo Time Shifting (DEMO_MODE=true)
When `DEMO_MODE=true` in `.env`, you can shift the reference date forwards:

```bash
curl -X POST "http://localhost:8000/admin/jobs/run-daily-scan" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"as_of": "2026-11-20", "dry_run": false}'
```
This simulates advancing calendar time, transitioning `DEMO-20D` and `DEMO-5D` to `MATURED` and triggering subsequent overdue reminders.

---

## 4. Viewing Notifications & Emails

### Inspect MailHog Email Inbox
Open your browser at:
```
http://localhost:8025
```
You will see rendered HTML and text emails with:
- Formal AICTE headers
- Masked reference numbers (e.g. `***********-85D`)
- Remaining days and maturity dates
- Direct links to the portal

### In-App Notifications
Log in as DTU Registrar (`registrar@dtu.ac.in`) and call:
```bash
curl -X GET "http://localhost:8000/notifications" \
  -H "Authorization: Bearer <DTU_ACCESS_TOKEN>"
```

---

## 5. Acknowledgment & Escalation Flow

1. An alert at Level 0 (INSTITUTION) has `escalate_after_days=7`.
2. If unacknowledged after 7 days, `run_escalation()` creates a child alert at Level 1 (`VERIFYING_OFFICER`).
3. Calling `POST /alerts/{id}/acknowledge` marks `acknowledged_at` and stops escalation.

---

## 6. Renewal Lifecycle & Lineage

1. **Initiate Renewal**: DTU calls:
```bash
curl -X POST "http://localhost:8000/instruments/<DEMO_85D_ID>/renew" \
  -H "Authorization: Bearer <DTU_ACCESS_TOKEN>"
```
Creates a new stub instrument with `replaces_instrument_id = <DEMO_85D_ID>`.

2. **Scrutiny & Activation**: Verifying Officer checks bank and Approver activates the new instrument:
```bash
curl -X POST "http://localhost:8000/instruments/<NEW_ID>/activate" \
  -H "Authorization: Bearer <APPROVER_ACCESS_TOKEN>"
```
Atomically:
- Old instrument `DEMO-85D` transitions to `RENEWED`.
- `RenewalLink` is created (`renewed_after_maturity=False`).
- All active alerts on `DEMO-85D` are auto-resolved with reason `instrument_renewed`.

3. **Query Lineage Tree**:
```bash
curl -X GET "http://localhost:8000/instruments/<NEW_ID>/lineage" \
  -H "Authorization: Bearer <TOKEN>"
```
Returns the full chain of renewals and replacements with timestamps and maturity statuses.


---

## 7. Phase 5 Release & Refund Workflow Demo

### Step 1: Run Phase 5 Seed Data
```bash
docker compose exec backend python -m app.scripts.seed_phase5
```
Seeds 6 institutions across Delhi, Maharashtra, Karnataka, Tamil Nadu, Gujarat, and UP, with instruments across all statuses, default release conditions, and sample requests.

### Step 2: Institution Requests Release
Institution submits a release request:
```bash
curl -X POST "http://localhost:8000/instruments/<ACTIVE_FDR_ID>/release-requests" \
  -H "Authorization: Bearer <INSTITUTION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "request_type": "RELEASE",
    "reason": "Institutional accreditation and statutory term fulfilled",
    "beneficiary_details": {
      "account_holder_name": "Delhi College of Engineering",
      "account_number": "123456789012",
      "bank_name": "State Bank of India",
      "ifsc_code": "SBIN0001234"
    }
  }'
```
- Mandatory automatic checks run instantly (`INSTRUMENT_BANK_VERIFIED`, `NO_OPEN_RENEWAL`, `NO_UNRESOLVED_DISCREPANCY`).
- Beneficiary details are encrypted via AES-256-GCM.
- Instrument transitions to `RELEASE_REQUESTED`, request status becomes `PENDING`.

### Step 3: Verifying Officer Scrutiny & Recommendation
Officer starts review and evaluates checklist:
```bash
# Start review
curl -X POST "http://localhost:8000/release-requests/<REQUEST_ID>/start-review" \
  -H "Authorization: Bearer <OFFICER_TOKEN>"

# Update manual checklist conditions
curl -X POST "http://localhost:8000/release-requests/<REQUEST_ID>/conditions" \
  -H "Authorization: Bearer <OFFICER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "results": [
      {"condition_id": "<COND_APPROVAL_ID>", "result": "PASS", "notes": "Compliance records clear"},
      {"condition_id": "<COND_COMPLIANCE_ID>", "result": "PASS", "notes": "No vigilance inquiries"}
    ]
  }'

# Submit recommendation
curl -X POST "http://localhost:8000/release-requests/<REQUEST_ID>/recommend" \
  -H "Authorization: Bearer <OFFICER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendation": "RECOMMEND",
    "notes": "All statutory requirements satisfied. Recommended for final release."
  }'
```

### Step 4: Approving Authority Approval & Atomic Closure Letter Generation
Approving authority reviews and approves:
```bash
curl -X POST "http://localhost:8000/release-requests/<REQUEST_ID>/approve" \
  -H "Authorization: Bearer <APPROVER_TOKEN>"
```
Atomically:
1. Validates segregation of duties (approver $\neq$ recommending officer).
2. Generates official PDF certificate via ReportLab with unique reference `AICTE-FDR-REL-YYYY-NNNNNN` and SHA-256 tamper-proof code.
3. Encrypts PDF in MinIO with `doc_type="CLOSURE"`.
4. Transitions instrument to `RELEASED` (terminal).
5. Auto-resolves all open alerts with reason `"released"`.
6. Sends completion notifications to institution users.

### Step 5: Verification & Reporting
Verify the generated certificate:
```bash
curl -X GET "http://localhost:8000/closure/verify/AICTE-FDR-REL-2026-000001" \
  -H "Authorization: Bearer <TOKEN>"
```

Download executive portfolio statements and upcoming maturity reports in XLSX or PDF:
```bash
curl -X GET "http://localhost:8000/reports/institution-statement?format=pdf" \
  -H "Authorization: Bearer <TOKEN>" --output statement.pdf
```
