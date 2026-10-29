# AICTE Security Deposit / FDR Management Portal

> **Smart India Hackathon — Problem Statement 26265**
>
> End-to-end tracking of every institution's security deposit and Fixed Deposit
> Receipt (FDR) from submission to release, built for AICTE's Regulation Bureau.

---

## Tech Stack

| Layer           | Technology                                      |
|-----------------|-------------------------------------------------|
| Backend API     | Python 3.11+, FastAPI, Pydantic v2              |
| Security & Auth | JWT, Bcrypt, 2-Step OTP, SlowAPI, Argon2/AES-GCM|
| ORM / Migrations| SQLAlchemy 2.0 (async), Alembic                 |
| Database        | PostgreSQL 16 (Append-Only Triggers, JSONB)     |
| Cache / Queue   | Redis 7 (Rate Limiter / Celery)                 |
| Object Storage  | MinIO (S3-compatible, AES-256-GCM Encrypted)    |
| Packaging       | Docker Compose                                  |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/install/) ≥ 2.20

## Quick Start

```bash
# 1. Clone and enter the repo
cd fdr-portal

# 2. Create your env file
cp .env.example .env        # defaults work for local dev

# 3. Start all services
docker compose up --build -d

# 4. Run database migrations (Phase 1, Phase 2, Phase 3, Phase 4)
docker compose exec backend alembic upgrade head

# 5. Seed default institutions, role accounts, mock bank registry, and Phase 4 alert rules / demo instruments
docker compose exec backend python -m app.scripts.seed_users
docker compose exec backend python -m app.scripts.seed_bank_registry
docker compose exec backend python -m app.scripts.seed_phase4

# 6. Verify health
curl http://localhost:8000/health
# → {"status":"ok","db":"ok","version":"0.1.0"}
```

---

## Seed Accounts & Role Credentials

The seed script creates the following default accounts (`app.scripts.seed_users`):

| Role | Email | Password | Scope / Institution |
|------|-------|----------|---------------------|
| **ADMIN** | `admin@aicte.gov.in` | `Admin@AICTE2026!` | Global / All Institutions |
| **VERIFYING_OFFICER** | `officer@aicte.gov.in` | `Officer@AICTE2026!` | Global / All Institutions |
| **APPROVING_AUTHORITY** | `approver@aicte.gov.in` | `Approver@AICTE2026!` | Global / All Institutions |
| **INSTITUTION** | `registrar@dtu.ac.in` | `Inst1@AICTE2026!` | Delhi Technological University |
| **INSTITUTION** | `registrar@coep.ac.in` | `Inst2@AICTE2026!` | College of Engineering Pune |

---

## Phase 3 Features & Workflows

### 1. Submit an FDR Instrument (Institution)
```bash
curl -X POST http://localhost:8000/instruments/ \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reference_number": "FDR-SBI-2025-001",
    "issuing_bank": "State Bank of India",
    "branch": "Parliament Street, New Delhi",
    "amount": "2500000.00",
    "required_amount": "2500000.00",
    "issue_date": "2025-01-15",
    "maturity_date": "2028-01-15"
  }'
```

### 2. Encrypted Document Upload (AES-256-GCM)
Documents are validated against magic bytes (PDF, JPEG, PNG), encrypted with AES-256-GCM, and stored in MinIO:
```bash
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/documents/ \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>" \
  -F "file=@certificate.pdf;type=application/pdf" \
  -F "doc_type=FDR_CERTIFICATE"
```

### 3. Officer Scrutiny Workflow
```bash
# Officer starts scrutiny (moves SUBMITTED -> UNDER_SCRUTINY, assigns officer)
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/start-scrutiny \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>"

# Run Bank Verification against registry (API / Mock)
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/verify \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>"

# Add scrutiny observation
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/observations \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category": "bank_confirmation", "text": "Bank verified match.", "severity": "INFO"}'

# Mark verified
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/mark-verified \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>"

# Approving authority activates
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/activate \
  -H "Authorization: Bearer <APPROVER_ACCESS_TOKEN>"
```

### 4. Discrepancy & Resubmit Workflow
```bash
# Officer flags discrepancy
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/flag-discrepancy \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Amount does not match deposit receipt."}'

# Institution corrects instrument data
curl -X PATCH http://localhost:8000/instruments/<INSTRUMENT_ID> \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"amount": "2500000.00"}'

# Institution resubmits (DISCREPANCY -> SUBMITTED)
curl -X POST http://localhost:8000/instruments/<INSTRUMENT_ID>/resubmit \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>"
```

---

## Phase 4: Automated Monitoring, Alerts & Renewal Workflows

### 1. Trigger Daily Scan (Admin)
```bash
# Live daily monitoring scan (evaluates validity, triggers reminders)
curl -X POST http://localhost:8000/admin/jobs/run-daily-scan \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false}'

# Time-shifted demo scan (requires DEMO_MODE=true in .env)
curl -X POST http://localhost:8000/admin/jobs/run-daily-scan \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"as_of": "2026-11-15", "dry_run": false}'
```

### 2. View Delivered Emails in MailHog
Open your web browser at:
```
http://localhost:8025
```
Inspect generated HTML and plain-text emails for 90d, 60d, 30d, 7d reminders and overdue notices with masked FDR references.

### 3. In-App Notifications
```bash
# List user inbox
curl -X GET http://localhost:8000/notifications \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>"

# Mark notification read
curl -X POST http://localhost:8000/notifications/<NOTIF_ID>/read \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>"
```

### 4. Alert Acknowledgment & Escalation
```bash
# Acknowledge an alert to halt automatic escalation to Verifying Officer / Approver
curl -X POST http://localhost:8000/alerts/<ALERT_ID>/acknowledge \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>"

# Resolve an alert with explanation note (Officer / Admin)
curl -X POST http://localhost:8000/alerts/<ALERT_ID>/resolve \
  -H "Authorization: Bearer <OFFICER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Fixed deposit renewed and confirmed by branch manager."}'
```

### 5. Instrument Renewal & Lineage Tree
```bash
# 1. Institution initiates renewal for an ACTIVE or EXPIRING instrument
curl -X POST http://localhost:8000/instruments/<OLD_INSTRUMENT_ID>/renew \
  -H "Authorization: Bearer <INSTITUTION_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"amount": "5500000.00"}'

# 2. When the new replacement instrument is verified & activated by Approver:
#    - New instrument transitions to ACTIVE
#    - Old instrument automatically transitions to RENEWED
#    - RenewalLink record is created
#    - Linked alerts are auto-resolved

# 3. View the complete renewal lineage chain:
curl -X GET http://localhost:8000/instruments/<INSTRUMENT_ID>/lineage \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Running Tests

```bash
# Run complete test suite (Phase 1 + Phase 2 + Phase 3 + Phase 4)
docker compose exec backend pytest -v
```

---

## Project Structure

```
fdr-portal/
├── backend/
│   ├── app/
│   │   ├── core/        # Config, clock abstraction (IST), security (bcrypt/JWT/OTP), RBAC dependencies
│   │   ├── db/          # Session, base, 19 models, domain enums
│   │   ├── api/         # Routers: /health, /auth, /admin, /audit, /instruments, /documents,
│   │   │                #          /alert-rules, /alerts, /notifications
│   │   ├── schemas/     # Pydantic v2 schemas (auth, instrument, alert_rule, alert, notification, etc.)
│   │   ├── services/    # AuthService, AuditService, InstrumentStateMachine, ValidationService,
│   │   │                # MonitoringService (daily scan), EscalationService, RenewalService,
│   │   │                # NotificationService, AlertSender (Email/SMS/InApp), DocumentService
│   │   ├── workers/     # Celery app, periodic tasks (daily scan, alert dispatcher, escalation)
│   │   ├── templates/   # Jinja2 email and SMS templates (HTML + text)
│   │   ├── scripts/     # seed_users.py, seed_bank_registry.py, seed_phase4.py
│   │   └── main.py      # FastAPI app factory with SlowAPI rate-limiting & mounted routers
│   ├── alembic/         # Migrations (001, 002, 003, 004_phase4_tables)
│   ├── tests/           # pytest suite (clock discipline, state machine, monitoring, escalation,
│   │                    #               renewal, alert rules, alert sender, notifications, celery)
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/             # Phase 6 React 18 + TypeScript + Vite + Tailwind Frontend
│   ├── src/
│   │   ├── api/          # Axios client with 401 refresh queue, query keys, v1.d.ts
│   │   ├── components/   # UI design system tokens (StatusBadge, VerificationTag, etc.)
│   │   ├── features/     # Feature domains (auth, instruments, releases, officer, admin, reports)
│   │   ├── i18n/         # Centralized government localization
│   │   ├── routes/       # React Router v6 guarded routing
│   │   └── utils/        # formatINR (Lakh/Crore), formatDateIST, Zod validation
│   ├── tests/            # Vitest unit test suites
│   ├── e2e/              # Playwright E2E and WCAG 2.1 AA accessibility specs
│   ├── Dockerfile        # Production multi-stage Nginx build
│   └── Dockerfile.dev    # Development Vite server
├── docs/
│   ├── ARCHITECTURE.md   # System, sequence, state machine, escalation & ER diagrams
│   └── DEMO_TIMELINE.md  # Step-by-step Phase 4 demo guide with sample timeline instruments
├── docker-compose.yml    # Postgres 16, Redis 7, MinIO, MailHog, Backend, Celery, Frontend
├── .env.example
└── README.md
```

---

## Phase 6 Frontend Portal

### 1. Technology & Design System
- **Core Framework**: React 18 with TypeScript in strict mode, powered by Vite.
- **Styling**: Tailwind CSS with official AICTE design tokens:
  - **AICTE Deep Blue** (`#1B365D`, `#12243e`) as authoritative primary.
  - **Saffron Accent** (`#C28212`) for highlights and action triggers.
  - **Government Typography & Tone**: Clean, calm, high-contrast, official.
- **Status Color Language (`StatusBadge`)**:
  - `SUBMITTED` (Slate) • `UNDER_SCRUTINY` (Blue) • `VERIFIED` (Teal) • `DISCREPANCY` (Red) • `ACTIVE` (Emerald) • `EXPIRING` (Amber) • `MATURED` (Orange) • `RENEWED` (Purple) • `RELEASE_REQUESTED` (Indigo) • `RELEASED` (Dark Slate).
  - Every badge includes a distinct icon, text label, and accessibility `role="status"`.
- **Source Verification (`VerificationTag`)**:
  - Prominently distinguishes **"Bank-Verified"** (filled teal badge with shield-check icon and source metadata) from **"Self-Declared"** (neutral outlined badge).
- **Financial Formatting**: `formatINR` formats Decimal strings in Indian numbering (₹ with Lakh/Crore commas e.g. `₹12,50,000`) without floating point precision degradation.
- **Date Standardization**: `formatDateIST` enforces Asia/Kolkata timezone formatting (`DD MMM YYYY`).

### 2. Role-to-Screen Access Matrix
| Screen / Capability | Institution | Verifying Officer | Approving Authority | Admin |
|---|:---:|:---:|:---:|:---:|
| **Institution Dashboard / Home** | ✓ | — | — | — |
| **My FDRs Portfolio** | ✓ | — | — | — |
| **New FDR 3-Step Wizard** | ✓ | — | — | — |
| **FDR Detail & Renewal Lineage DAG** | ✓ | ✓ | ✓ | ✓ |
| **Release & Refund Submission Wizard** | ✓ | — | — | — |
| **Notifications & Account Statement** | ✓ | ✓ | ✓ | ✓ |
| **Executive Monitoring Dashboard** | — | ✓ | ✓ | ✓ |
| **Scrutiny Work Queue (Ageing SLAs)** | — | ✓ | — | — |
| **Side-by-Side Scrutiny & Bank Match** | — | ✓ | — | — |
| **Advanced Instrument Search** | — | ✓ | ✓ | ✓ |
| **Alerts & Escalations Management** | — | ✓ | ✓ | ✓ |
| **Statutory Reports & Data Export** | ✓ (Scoped) | ✓ | ✓ | ✓ |
| **Approvals Inbox & One-Click Release**| — | — | ✓ | ✓ |
| **User & Access Directory** | — | — | — | ✓ |
| **Accredited Institutions Registry** | — | — | — | ✓ |
| **Alert Rule Configuration Builder** | — | — | — | ✓ |
| **Release Conditions Catalog** | — | — | — | ✓ |
| **Hash-Chained Audit Trail Verification** | — | — | — | ✓ |
| **Impact & ROI Governance Board** | — | — | — | ✓ |
| **Demo Scan Runner & Time-Warp** | — | — | — | ✓ |

### 3. Security & Token Storage Model
- **In-Memory JWT Access Token**: The short-lived bearer token is maintained purely in memory via React Context and never stored in `localStorage` or `sessionStorage` (preventing XSS leakage).
- **SessionStorage Refresh Token**: The refresh token is maintained in `sessionStorage` (cleared automatically upon browser tab closure).
- **Single-Flight Refresh Mutex**: An Axios interceptor queues parallel 401 requests while a single background refresh request is executed, preventing redundant token refresh calls.
- **Inactivity Timeout**: Automatic session termination after 15 minutes of user inactivity.
- **Decrypted Document Downloads**: Downloadable certificates are fetched via authenticated API requests, converted to temporary object URLs (`blob:`), and immediately revoked upon completion.

### 4. Running the Frontend
```bash
# Development server (Port 5173)
cd frontend
npm install
npm run dev

# Or run alongside the entire stack via Docker Compose
docker compose up --build frontend
```

## License

Internal — AICTE Regulation Bureau.


---

## Phase 5 Endpoints & Role Access Matrix

### 1. Release & Refund Workflow
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/instruments/{id}/release-requests` | `INSTITUTION` | Submit release or refund request with encrypted beneficiary details |
| `POST` | `/release-requests/{id}/withdraw` | `INSTITUTION` | Withdraw pending request, restoring instrument to previous status |
| `POST` | `/release-requests/{id}/start-review` | `VERIFYING_OFFICER`, `ADMIN` | Move request to `UNDER_REVIEW` |
| `POST` | `/release-requests/{id}/conditions` | `VERIFYING_OFFICER`, `ADMIN` | Record manual condition evaluations |
| `POST` | `/release-requests/{id}/recommend` | `VERIFYING_OFFICER` | Submit recommendation to Approving Authority |
| `POST` | `/release-requests/{id}/approve` | `APPROVING_AUTHORITY` | Atomically approve release, issue closure certificate, and release lien |
| `POST` | `/release-requests/{id}/reject` | `VERIFYING_OFFICER`, `APPROVING_AUTHORITY` | Reject request with reason, restoring instrument to previous status |
| `GET` | `/release-requests` | All (Scoped) | List requests (Institutions see own; Officers/Admin filter across portal) |
| `GET` | `/release-requests/{id}` | All (Scoped) | View full details with conditions, timeline, and role-masked beneficiary info |
| `GET` | `/closure/verify/{ref}` | All (Scoped) | Verify authenticity and SHA-256 integrity stamp of discharge certificates |

### 2. Search & Advanced Filtering
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/instruments/search` | All (Scoped) | Parameterized, SQL-injection-safe multi-criteria instrument search |

### 3. Dashboard Analytics (Redis Cached)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/dashboard/summary` | All (Scoped) | KPI summary across active, maturing, overdue, renewed, and pending groups |
| `GET` | `/dashboard/maturity-pipeline`| All (Scoped) | 12-month rolling maturity distribution buckets and overdue count |
| `GET` | `/dashboard/by-bank` | All (Scoped) | Counts and amounts grouped by issuing bank and status |
| `GET` | `/dashboard/by-state` | All (Scoped) | Geographic breakdown by institution state and status |
| `GET` | `/dashboard/pending-actions` | All (Scoped) | Actionable queues: pending scrutiny ageing, discrepancies, releases |
| `GET` | `/dashboard/impact-metrics` | Officers / Admin | Turnaround days, renewal timeliness, and automated intervention counts |

### 4. Pluggable Reports Engine
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/reports/` | All | Discover available report types for the user's role |
| `GET` | `/reports/{type}?format=json\|csv\|xlsx\|pdf` | Officers / Admin / Inst | Stream report exports with formula injection protection and audit logging |

### 5. Release Conditions Administration
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/admin/release-conditions` | `ADMIN` | List all configured release conditions |
| `POST` | `/admin/release-conditions` | `ADMIN` | Create a new release condition (audited) |
| `PATCH` | `/admin/release-conditions/{id}` | `ADMIN` | Update condition metadata and mandatory/automatic flags (audited) |

---

## Phase 7: AI/ML Assistance, Intelligence & Governance (SIH PS 26265)

Phase 7 introduces an end-to-end, ethical, and explainable AI/ML pipeline to assist AICTE officers and institutions without violating core human-in-the-loop governance invariants.

### 1. Architectural Invariants & Ethics
1. **Advisory Assistance Only ("Officers Decide")**: No AI module or interface element can mutate an instrument's status, approve/reject a release request, resolve an alert, or edit core records.
2. **Data Honesty**: Every score, turnaround estimate, and model evaluation prominently displays `data_source` and `model_version`. Synthetic figures always carry a visible `Synthetic data` badge and explanatory tooltip.
3. **Mathematical Explainability**: No bare numbers. Trust scores expose 10-factor breakdowns with weights and contributions; turnaround predictions provide 90% confidence intervals and deadline risk flags.
4. **Graceful Degradation**: Dual-gated activation (`VITE_FEATURE_AI=true` AND `/api/v1/ai/config`). If OCR or LLM dependencies are down, standard manual entry and officer workflows continue uninterrupted.
5. **Privacy Guard**: Strict allow-list filtering ensures no PII, beneficiary credentials, tokens, or raw OCR documents leave the secure boundary.

### 2. Phase 7 Endpoints & Role Access Matrix

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/ai/config` | All (Authenticated) | Runtime configuration flags and sub-feature toggles |
| `POST` | `/api/v1/ai/ocr/preview` | `INSTITUTION`, Officers, Admin | Synchronous OCR extraction from document upload for form autofill |
| `GET` | `/api/v1/ai/trust-scores/{id}` | Officers, Admin | Complete 10-factor mathematical breakdown and risk band |
| `POST` | `/api/v1/ai/trust-scores/{id}/recompute`| Officers, Admin | Force-refresh Trust Score against current weights version |
| `GET` | `/api/v1/ai/predictions/{id}` | Officers, Admin | Turnaround days point estimate, 90% confidence interval & risk tags |
| `POST` | `/api/v1/instruments/nl-search` | Officers, Admin | Natural language query search with rule-based/LLM fallback |
| `POST` | `/api/v1/ai/feedback` | `INSTITUTION` (OCR), Officers, Admin | Submit agreement/correction feedback for active learning |
| `GET` | `/api/v1/ai/feedback/stats` | `ADMIN` | Aggregated feedback volume and officer agreement rates |
| `GET` | `/api/v1/ai/weights` | `ADMIN` | View current and historical Trust Score factor weight versions |
| `PUT` | `/api/v1/ai/weights` | `ADMIN` | Update active weights configuration (must sum to exactly 100) |
| `GET` | `/api/v1/ai/models` | `ADMIN` | Production model registry listing champion/challenger models & metrics |
| `POST` | `/api/v1/ai/models/{id}/promote` | `ADMIN` | Promote challenger or rollback to previous champion model |

### 3. Frontend AI Capabilities (Phase 7C)
- **OCR Auto-Fill & Review Modal**: Side-by-side verification dialog with per-field confidence meters and selective form field insertion.
- **Natural Language Search Bar**: 200-char search bar with sample chips, interpreter indication ("AI" vs "Rules"), and parameter chip management.
- **Explainable Trust Score Badge & Popover**: Risk bands (`Low risk`, `Needs review`, `High priority`) and mathematical breakdown card.
- **Approval-Time Prediction Chip**: Point estimate and interval display with automatic "At risk" tag if predicted completion exceeds deadline.
- **Document Discrepancy Warnings**: Prominent warning cards for `OCR_MISMATCH`, `CROSS_DOC_MISMATCH`, and `DOC_TYPE_SUSPECT`.
- **Officer Active Learning Buttons**: One-click feedback thumbs and "Correct Flag / False Alarm" buttons with deduplication safeguards.
- **Admin AI Console**:
  - `/admin/ai/weights`: Weight history, slider-based draft editor with live 100% sum validation.
  - `/admin/ai/models`: Registry table, holdout metrics drawer (MAE, R², RMSE), and model promotion.
  - `/admin/ai/health`: Rolling reward timeline chart (7d/30d/90d), agreement rates, and accessible data table.
  - `/admin/ai/feedback`: System-wide telemetry breakdown by AI sub-service.

---

## Single-Screen Public Landing Page ("Saksham")

The public landing page at `/` is designed as a single-screen, zero-scroll web experience on desktop and laptop displays (`100dvh`), adhering to WCAG 2.1 AA accessibility standards and official AICTE styling.

### 1. Structure & Layout
- **Header Bar**: Fixed dark navy header (`#0B192C`) with Saksham portal identity, navigation links, and direct Login entry.
- **Cinematic Hero**: Left-column typography with fluid clamp scaling, three-line headline (*"Streamlining / Security Deposits / & FDRs"*), primary CTA buttons ("Login" and "How it works"). Right side features an optimized campus image dissolving smoothly into the dark navy canvas.
- **Zero-Scroll Modals**: All rich content (*About, Modules & Architecture, How it works, Contact, Accessibility*) opens inside keyboard-accessible dialog modals (`Escape` to close, `aria-modal="true"`) to preserve a clean single-viewport presentation.
- **Offline / Zero Backend Dependency**: The landing page functions fully with zero runtime network or API calls, ensuring high availability even if the backend is offline.

### 2. Branding & Asset Management
- **Logo Configuration**: Drop the official AICTE SVG/PNG into `frontend/src/assets/brand/aicte-logo.svg` or `frontend/public/saksham-logo.png`. If missing, the `<BrandMark />` component automatically falls back to an accessible text-based placeholder.
- **Hero Background**: Located at `frontend/src/assets/home/` and `frontend/public/home/`:
  - `hero-bg-1920.webp` & `hero-bg-1920.jpg` (Full HD desktop fallback)
  - `hero-bg-960.webp` & `hero-bg-960.jpg` (Mobile/tablet responsive asset)

### 3. Natural Language Search (NL Search) Module
- **Frontend Route**: [`/officer/search`](http://localhost:5173/officer/search)
- **Navigation**: Accessible from the left sidebar under **"Search Instruments"** for authenticated **Verifying Officers**, **Approving Authorities**, and **Admins**.
- **Component**: `frontend/src/features/ai/nlsearch/NlSearchBar.tsx` inside `FDRSearch.tsx`.
- **Backend API**: `POST /api/v1/ai/nlsearch/parse` (`backend/app/api/ai_nlsearch.py`). Supports conversational queries (e.g., *"show active SBI deposits in Karnataka over 50 lakhs"*) and translates them into structured filter chips with confidence indicators.
- **Landing Page Discovery**: Featured prominently as the spotlight tool in the **Modules** dialog on the public landing page.

### 4. Interactive AI Copilot Chatbot (Modules 4 & 5)
A persistent floating AI assistant (`<SakshamChatbot />`) available across both the public home page and the authenticated AppShell with strict role-based access control:

#### Role-Based Access Rules
- **Module 4: Institutional Compliance Intelligence**:
  - **Availability:** Available for **everyone who is logged in** (Institutions, Verifying Officers, Approving Authorities, Admins).
  - Unauthenticated guests on the landing page receive statutory guidelines and an interactive prompt to log in for institution-specific audits.
  - **Capabilities & Preset Scenarios (12 questions):**
    1. DTU Deposit Compliance Health Status (₹50L required vs verified, 100% compliant).
    2. COEP Release & Refund Eligibility (10-year lock-in audit, DTE clearance).
    3. AICTE Mandatory FDR Norms (APH 2026-27 deposit criteria across programs).
    4. Real-time Overdue Renewals Pipeline (>30d, <30d, 31-90d pipeline).
    5. Deposit Shortfall Calculation Formula & 4-Stage Regulatory Escalation Ladder.
    6. Step-by-step Replacement / Rollover FDR Submission Procedure.
    7. Statutory Release & Refund Document Checklist (5-document dossier).
    8. Handling Bank Mergers, Branch Amalgamations & Automated IFSC Migration.
    9. Strict Inadmissibility of Mutual Funds, Shares, or Corporate Bonds.
    10. Legal Penalties for Unauthorized Premature FDR Encashment.
    11. Tracking Uploaded FDR Verification Stages (Submitted → Scrutiny → Bank → Approved).
    12. Policy Comparison: Government / Aided vs Private Self-Financing Colleges.

- **Module 5: Explainable AI Assistance**:
  - **Availability:** Strictly restricted to **Verifying Officers** and **Approving Authorities** (and Admins).
  - Institution users and unauthenticated guests are protected by an ethical governance boundary explaining that internal model decomposition and risk weights are reserved for regulatory officers under Phase 7 Governance Invariants.
  - **Capabilities & Preset Scenarios (12 questions):**
    1. 10-Factor Trust Score 72 Mathematical Breakdown on `FDR-SBI-2025-001`.
    2. Turnaround Prediction Engine (4.2 business days with [3.1 – 5.8d] 90% CI).
    3. OCR Mismatch Root Cause Analysis (₹50,00,000 declared vs ₹5,00,000 extracted).
    4. 10-Factor Weights Calibration Governance (100% sum validation, Champion v2.4).
    5. The 5 Ethical AI Governance Invariants in Saksham.
    6. Root-cause classification of `DOC_TYPE_SUSPECT` warnings.
    7. Branch IFSC & Spatial Geolocation Distance Verification Logic.
    8. Fast-Track Verification Criteria for High-Trust Instruments (Score > 85).
    9. Active Learning & Telemetry Retraining via `/api/v1/ai/feedback`.
    10. Predictive "At Risk" Turnaround SLA Warning Trigger Logic.
    11. Approver Override Authority & Immutable SHA-256 Chained Audit Trail.
    12. 3-Way Cross-Document Reconciliation (Portal Form, FDR Image, Bank Letter).

- **Access**: Click the floating **"Saksham Copilot"** pill at the bottom-right corner of any screen or use the mode tabs to switch between Compliance Intelligence and Explainable AI.

### 5. Multilingual e-Governance Support (5 Languages)
The Saksham portal complies with Indian e-Governance guidelines for multilingual public and administrative access:
- **Supported Languages**:
  1. **English (`en`)**: Primary administrative and technical language.
  2. **हिन्दी (Hindi, `hi`)**: Official Union Language adhering to official Rajbhasha e-Governance terminology.
  3. **मराठी (Marathi, `mr`)**: Regional technical university coverage (Western region).
  4. **தமிழ் (Tamil, `ta`)**: Regional coverage for Southern institutions.
  5. **తెలుగు (Telugu, `te`)**: Regional coverage for AP/Telangana institutions.
- **Language Selector Component**: Accessible via `<LanguageSelector />` integrated on the top navigation bar of both the public landing page (`HomeHeader.tsx`) and all authenticated pages (`TopBar.tsx`).
- **Dynamic Persistence**: Automatically saves the user's preferred language in `localStorage` (`saksham_language`) and synchronizes the HTML `lang` attribute on the document root (`<html lang="...">`).
- **Multilingual AI Chatbot**: The chatbot interface and query keyword matcher support Hindi and regional script queries (e.g. डीटीयू, सीओईपी, नियम, ट्रस्ट स्कोर).





