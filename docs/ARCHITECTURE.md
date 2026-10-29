# FDR Portal — Architecture

## Component Diagram

```mermaid
flowchart TD
    subgraph Client
        FE["Frontend / API Client"]
    end

    subgraph Backend["Backend (FastAPI)"]
        AUTH_ROUTER["/auth (JWT + OTP)"]
        ADMIN_ROUTER["/admin (RBAC)"]
        AUDIT_ROUTER["/audit"]
        HEALTH_ROUTER["/health"]
        INSTRUMENT_ROUTER["/instruments (CRUD + Scrutiny)"]
        DOC_ROUTER["/instruments/{id}/documents"]
        
        SVC_AUTH["AuthService"]
        SVC_AUDIT["AuditService (Hash-Chain)"]
        SVC_USER["UserService"]
        SVC_INST["InstrumentService"]
        SVC_STATE["InstrumentStateMachine"]
        SVC_VAL["ValidationService + OCR Hook"]
        SVC_DOC["DocumentService (AES-256-GCM)"]
        SVC_BANK["BankVerifier (Mock / API)"]
        
        DB_LAYER["SQLAlchemy 2.0 ORM"]
    end

    subgraph Infrastructure
        PG["PostgreSQL 16\n(Append-Only Triggers + JSONB)"]
        REDIS["Redis 7\n(Rate Limiter / Celery)"]
        MINIO["MinIO\n(S3-compatible Encrypted Store)"]
    end

    FE -->|REST / Bearer JWT| AUTH_ROUTER
    FE -->|REST / Bearer JWT| ADMIN_ROUTER
    FE -->|REST / Bearer JWT| AUDIT_ROUTER
    FE -->|REST / Bearer JWT| INSTRUMENT_ROUTER
    FE -->|REST / Bearer JWT| DOC_ROUTER
    FE -->|GET /health| HEALTH_ROUTER

    AUTH_ROUTER --> SVC_AUTH
    ADMIN_ROUTER --> SVC_USER
    AUDIT_ROUTER --> SVC_AUDIT
    INSTRUMENT_ROUTER --> SVC_INST
    INSTRUMENT_ROUTER --> SVC_STATE
    INSTRUMENT_ROUTER --> SVC_VAL
    INSTRUMENT_ROUTER --> SVC_BANK
    DOC_ROUTER --> SVC_DOC

    SVC_AUTH --> SVC_AUDIT
    SVC_USER --> SVC_AUDIT
    SVC_INST --> SVC_AUDIT
    SVC_STATE --> SVC_AUDIT
    SVC_DOC --> SVC_AUDIT
    SVC_BANK --> SVC_AUDIT

    SVC_AUTH --> DB_LAYER
    SVC_AUDIT --> DB_LAYER
    SVC_USER --> DB_LAYER
    SVC_INST --> DB_LAYER
    SVC_STATE --> DB_LAYER
    SVC_DOC --> DB_LAYER
    SVC_DOC --> MINIO
    SVC_BANK --> DB_LAYER
    DB_LAYER --> PG
```

## Two-Step Authentication Flow (JWT + OTP)

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Institution
    participant API as FastAPI /auth
    participant Service as AuthService
    participant OTP as OtpSender
    participant DB as PostgreSQL

    User->>API: POST /auth/login {email, password}
    API->>Service: login(email, password)
    Service->>DB: SELECT user WHERE email = ?
    alt Invalid Credentials or Inactive
        Service->>DB: INSERT failed_login_attempts + audit_logs(login_failure)
        Service-->>API: Error (Generic message)
        API-->>User: 401 Unauthorized ("Invalid credentials")
    else Valid Credentials
        Service->>Service: Generate 6-digit OTP (secrets) & hash with bcrypt
        Service->>DB: INSERT otp_challenges (otp_hash, expires_in=5m)
        Service->>OTP: send(user, plain_otp)
        Service-->>API: {challenge_id}
        API-->>User: 200 OK {challenge_id, message}
    end

    User->>API: POST /auth/verify-otp {challenge_id, otp}
    API->>Service: verify_otp_challenge(challenge_id, otp)
    Service->>DB: SELECT otp_challenge WHERE id = ?
    alt Expired / Used / Max attempts (>=5) / Wrong OTP
        Service->>DB: Increment attempts + audit_logs(otp_failure)
        Service-->>API: Error ("Invalid or expired OTP")
        API-->>User: 401 Unauthorized
    else Valid OTP
        Service->>DB: UPDATE otp_challenges SET is_used=true
        Service->>Service: Issue JWT access_token (15m) + refresh_token (7d)
        Service->>DB: INSERT refresh_tokens (jti, token_hash)
        Service->>DB: INSERT audit_logs (action="login_success")
        Service-->>API: {access_token, refresh_token, token_type, expires_in}
        API-->>User: 200 OK Tokens
    end
```

## Document Encryption & Storage Flow (AES-256-GCM)

```mermaid
sequenceDiagram
    autonumber
    actor Inst as Institution
    participant API as FastAPI /instruments/{id}/documents
    participant DS as DocumentService
    participant Enc as EncryptionService
    participant MinIO as MinIO S3
    participant DB as PostgreSQL
    participant Audit as AuditService

    Inst->>API: POST /documents (multipart file, doc_type)
    API->>API: Check ownership (institution_id match)
    API->>DS: upload(file_bytes, content_type, filename)
    DS->>DS: validate_file (magic bytes: PDF/JPEG/PNG, size <= 10MB, non-empty)
    DS->>DS: compute SHA-256 of plaintext
    DS->>Enc: encrypt(file_bytes)
    Enc->>Enc: Generate random 12-byte nonce (AES-GCM)
    Enc-->>DS: nonce + ciphertext + auth tag
    DS->>MinIO: put_object(bucket, storage_key, encrypted_stream)
    DS->>DB: INSERT documents (metadata, storage_key, sha256)
    DS->>Audit: record(action="document_upload")
    DS-->>API: Document model
    API-->>Inst: 201 Created (metadata, sans raw content)

    Note over Inst, MinIO: Secure Download Flow
    Inst->>API: GET /documents/{doc_id}/download
    API->>API: Check ownership / scope
    API->>DS: download(document)
    DS->>MinIO: get_object(bucket, storage_key)
    MinIO-->>DS: encrypted blob
    DS->>Enc: decrypt(encrypted)
    Enc->>Enc: Extract nonce (12B), verify tag, decrypt ciphertext
    Enc-->>DS: plaintext bytes
    DS-->>API: plaintext, original filename
    API-->>Inst: StreamingResponse (application/octet-stream, filename)
```

## Officer Scrutiny & Mock Bank Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Verifying Officer
    actor Approver as Approving Authority
    participant API as FastAPI /instruments
    participant SM as InstrumentStateMachine
    participant Bank as MockBankVerifier
    participant DB as PostgreSQL
    participant Audit as AuditService

    Officer->>API: POST /{id}/start-scrutiny
    API->>SM: transition(SUBMITTED -> UNDER_SCRUTINY)
    SM->>DB: UPDATE instruments (status, assigned_officer_id)
    SM->>DB: INSERT instrument_status_history
    SM->>Audit: record(action="status_transition")
    API-->>Officer: 200 OK {status: "UNDER_SCRUTINY"}

    Officer->>API: POST /{id}/verify
    API->>Bank: verify(ref_num, bank, amount, issue_date, maturity_date)
    Bank->>DB: SELECT mock_bank_registry WHERE ref_num = ?
    alt Match
        Bank-->>API: {found: true, matches: true}
        API->>DB: UPDATE instruments (verification_tag = "BANK_VERIFIED")
        API->>DB: INSERT verification_records (method="API", result="OK")
    else Mismatch / Not Found
        Bank-->>API: {found: true, matches: false, mismatches: {...}}
        API->>DB: INSERT verification_records (discrepancy_notes: {...})
    end
    API->>Audit: record(action="bank_verification")
    API-->>Officer: BankVerifyResponse

    alt Discrepancy Found
        Officer->>API: POST /{id}/flag-discrepancy {notes}
        API->>SM: transition(UNDER_SCRUTINY -> DISCREPANCY)
        API-->>Officer: 200 OK {status: "DISCREPANCY"}
    else Verification Satisfactory
        Officer->>API: POST /{id}/mark-verified
        API->>SM: transition(UNDER_SCRUTINY -> VERIFIED)
        API-->>Officer: 200 OK {status: "VERIFIED"}
        Approver->>API: POST /{id}/activate
        API->>SM: transition(VERIFIED -> ACTIVE)
        API-->>Approver: 200 OK {status: "ACTIVE"}
    end
```

## Tamper-Evident Hash Chain Architecture

```mermaid
flowchart LR
    subgraph Genesis
        G["prev_hash: GENESIS-FDR-PORTAL-v1"]
    end

    subgraph Entry1["Audit Entry #1"]
        E1_DATA["actor_id, action, entity_id\npayload, created_at"]
        E1_HASH["hash: SHA-256(G + E1_DATA)"]
    end

    subgraph Entry2["Audit Entry #2"]
        E2_PREV["prev_hash: Entry1.hash"]
        E2_DATA["actor_id, action, entity_id\npayload, created_at"]
        E2_HASH["hash: SHA-256(E2_PREV + E2_DATA)"]
    end

    subgraph EntryN["Audit Entry #N"]
        EN_PREV["prev_hash: EntryN-1.hash"]
        EN_DATA["actor_id, action, entity_id\npayload, created_at"]
        EN_HASH["hash: SHA-256(EN_PREV + EN_DATA)"]
    end

    G --> E1_HASH
    E1_HASH --> E2_PREV
    E2_PREV --> E2_HASH
    E2_HASH --> EN_PREV
    EN_PREV --> EN_HASH

    subgraph SecurityGuarantees["Tamper-Proofing Guarantees"]
        LOCK["pg_advisory_xact_lock(8675309)\nGuarantees strict linear serialization"]
        TRIGGER["PostgreSQL BEFORE UPDATE/DELETE Triggers\nRejects all mutations at DB engine level"]
        REDACT["Automatic Redaction\nPasswords, OTPs, Tokens replaced with [REDACTED]"]
        VERIFY["GET /audit/verify-chain\nRecomputes hashes to detect retro-modifications"]
    end
```

## FDR Status State Machine

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED
    SUBMITTED --> UNDER_SCRUTINY : start-scrutiny (VO/AA/Admin)
    UNDER_SCRUTINY --> VERIFIED : mark-verified (VO/AA/Admin)
    UNDER_SCRUTINY --> DISCREPANCY : flag-discrepancy (VO/AA/Admin)
    DISCREPANCY --> SUBMITTED : resubmit (Institution)
    VERIFIED --> ACTIVE : activate (AA/Admin)

    note right of ACTIVE
        Transitions below are defined
        in domain enum and reserved
        for Phase 4 (Scheduler) & Phase 5 (Release)
    end note
    ACTIVE --> EXPIRING : Phase 4
    EXPIRING --> MATURED : Phase 4
    MATURED --> RENEWED : Phase 4
    RENEWED --> ACTIVE : Phase 4
    ACTIVE --> RELEASE_REQUESTED : Phase 5
    RELEASE_REQUESTED --> RELEASED : Phase 5
    RELEASED --> [*]
```

## ER Diagram (Phase 1 + Phase 2 + Phase 3)

```mermaid
erDiagram
    INSTITUTION ||--o{ USER : employs
    INSTITUTION ||--o{ INSTRUMENT : owns
    INSTRUMENT ||--o{ DOCUMENT : has
    INSTRUMENT ||--o{ VERIFICATION_RECORD : checked_by
    INSTRUMENT ||--o| INSTRUMENT : replaces
    INSTRUMENT ||--o{ RENEWAL_LINK : linked_via
    INSTRUMENT ||--o{ RELEASE_REQUEST : requested_for
    INSTRUMENT ||--o{ ALERT : triggers
    INSTRUMENT ||--o{ INSTRUMENT_STATUS_HISTORY : transitions
    INSTRUMENT ||--o{ SCRUTINY_OBSERVATION : observes
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ VERIFICATION_RECORD : verifies
    USER ||--o{ RELEASE_REQUEST : requests
    USER ||--o{ RELEASE_REQUEST : decides
    USER ||--o{ ALERT : receives
    USER ||--o{ AUDIT_LOG : performs
    USER ||--o{ FEEDBACK_LABEL : labels
    USER ||--o{ OTP_CHALLENGE : requests
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ INSTRUMENT_STATUS_HISTORY : transitions
    USER ||--o{ SCRUTINY_OBSERVATION : writes

    INSTITUTION {
        uuid id PK
        string name
        string aicte_id UK
        string state
        string contact_email
        string contact_phone
        string approval_cycle
        timestamp created_at
    }

    USER {
        uuid id PK
        string email UK
        string phone
        string full_name
        string hashed_password
        enum role
        uuid institution_id FK
        bool is_active
        timestamp created_at
    }

    INSTRUMENT {
        uuid id PK
        uuid institution_id FK
        string reference_number UK
        string instrument_type
        string issuing_bank
        string branch
        decimal amount
        decimal required_amount
        date issue_date
        date maturity_date
        date claim_expiry_date
        string beneficiary_name
        string validity_status
        enum verification_tag
        enum status
        uuid replaces_instrument_id FK
        jsonb validation_flags
        uuid assigned_officer_id FK
        timestamp created_at
        timestamp updated_at
    }

    INSTRUMENT_STATUS_HISTORY {
        uuid id PK
        uuid instrument_id FK
        enum from_status
        enum to_status
        uuid changed_by FK
        text note
        timestamp changed_at
    }

    SCRUTINY_OBSERVATION {
        uuid id PK
        uuid instrument_id FK
        uuid observer_id FK
        string category
        text text
        string severity
        timestamp created_at
    }

    MOCK_BANK_REGISTRY {
        uuid id PK
        string reference_number UK
        string issuing_bank
        string branch
        decimal amount
        date issue_date
        date maturity_date
        string holder_name
        bool is_valid
    }

    DOCUMENT {
        uuid id PK
        uuid instrument_id FK
        string doc_type
        string storage_key
        string file_name
        string sha256
        int version
        uuid uploaded_by FK
        timestamp uploaded_at
    }

    VERIFICATION_RECORD {
        uuid id PK
        uuid instrument_id FK
        enum method
        string result
        uuid verified_by FK
        timestamp verified_at
        text discrepancy_notes
    }

    AUDIT_LOG {
        uuid id PK
        uuid user_id FK
        string action
        string entity_type
        uuid entity_id
        jsonb payload
        timestamp created_at
        text prev_hash
        text hash
    }

    ALERT_RULE {
        uuid id PK
        string name UK
        enum rule_type
        int days
        string_array channels
        enum recipient_role
        int escalate_after_days
        bool is_active
        timestamp created_at
    }

    ALERT {
        uuid id PK
        uuid instrument_id FK
        uuid rule_id FK
        string rule_name
        uuid recipient_user_id FK
        string channel
        date scheduled_for
        timestamp scheduled_at
        timestamp sent_at
        int escalation_level
        enum status
        int failure_count
        text last_error
        uuid acknowledged_by FK
        timestamp acknowledged_at
        bool resolved
        timestamp resolved_at
        string resolved_reason
        uuid parent_alert_id FK
    }

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        uuid alert_id FK
        string title
        text body
        bool is_read
        timestamp created_at
    }

    RENEWAL_LINK {
        uuid id PK
        uuid old_instrument_id FK
        uuid new_instrument_id FK
        bool renewed_after_maturity
        timestamp changed_at
    }
```

---

## Phase 4: Automated Tracking, Alerts, Escalation & Renewal

### 1. Clock Abstraction (`core/clock.py`)
- Standardized access to `today()` and `now()` pinned to IST (`Asia/Kolkata`).
- Supports programmatic overriding via `set_test_override()` and environment-driven calendar shifting via `CLOCK_OVERRIDE_DATE` when `DEMO_MODE=true`.
- Enforces strict isolation: service and worker code is forbidden from calling `date.today()` or `datetime.now()` directly.

### 2. Automated Validity & Maturity Scanner (`services/monitoring.py`)
- Executed on a daily beat schedule at 02:00 IST via Celery or manually triggered by Admin via `POST /admin/jobs/run-daily-scan`.
- Deterministic and strictly idempotent:
  - Detects `ACTIVE` instruments approaching maturity within the largest reminder window (default 90 days) and transitions them to `EXPIRING`.
  - Detects `ACTIVE` or `EXPIRING` instruments past their maturity date and transitions them to `MATURED`.
  - Evaluates configured `AlertRule` records and inserts pending alerts using a multi-column uniqueness constraint (`instrument_id`, `rule_id`, `recipient_user_id`, `channel`, `scheduled_for`, `escalation_level`), preventing duplicate alerts on repeated runs.
  - Automatically posts corresponding in-app `Notification` records for recipient users.

### 3. State Machine Extensions
```mermaid
stateDiagram-v2
    [*] --> SUBMITTED
    SUBMITTED --> UNDER_SCRUTINY
    UNDER_SCRUTINY --> DISCREPANCY
    DISCREPANCY --> SUBMITTED
    UNDER_SCRUTINY --> VERIFIED
    VERIFIED --> ACTIVE
    ACTIVE --> EXPIRING : maturity in <= 90 days
    ACTIVE --> MATURED : maturity < today
    EXPIRING --> MATURED : maturity < today
    ACTIVE --> RENEWED : renewal activated
    EXPIRING --> RENEWED : renewal activated
    MATURED --> RENEWED : renewal activated
    ACTIVE --> RELEASE_REQUESTED : Phase 5
    RELEASE_REQUESTED --> RELEASED : Phase 5
```

### 4. Alert Dispatch & Multi-Channel Delivery (`services/alert_sender.py`)
- Dispatcher periodic task runs every 5 minutes batching `PENDING` alerts.
- **Email Delivery**: Formatted HTML and plain-text emails delivered to MailHog (port 1025) or configured SMTP server.
- **SMS Delivery**: Console and Twilio providers. Reference numbers are automatically masked (all but last 4 characters replaced with `*`).
- **In-App Inbox**: Dedicated user inbox accessible via `/notifications` with read-state tracking.
- **Fault Tolerance**: Automatic retry with exponential backoff (`ALERT_RETRY_BASE_SECONDS * 2^retries`). Alerts reaching 5 failures transition to `FAILED` without blocking sibling alerts.

### 5. Multi-Level Escalation Engine (`services/escalation.py`)
- Unacknowledged alerts exceeding `rule.escalate_after_days` automatically trigger escalation:
  - **Level 0 (Institution)**: Sent to institution registrar/admins.
  - **Level 1 (Verifying Officer)**: Created after grace period expires with `parent_alert_id` link.
  - **Level 2 (Approving Authority)**: Critical escalation when Officer alert remains unacknowledged.
- Calling `POST /alerts/{id}/acknowledge` records timestamp and user, immediately stopping further escalation.
- Resolving an instrument (e.g. renewal completion or activation) invokes `auto_resolve_alerts()` which marks all linked open alerts resolved in the same transaction.

### 6. Renewal & Lineage Tracking (`services/renewal_service.py`)
- **Initiation**: `POST /instruments/{id}/renew` validates status (`ACTIVE`, `EXPIRING`, `MATURED`), verifies no duplicate in-flight renewals, and spawns a new instrument stub (`status=SUBMITTED`, `replaces_instrument_id=old.id`).
- **Atomic Completion**: Upon scrutiny verification and Approver activation (`POST /instruments/{new_id}/activate`), the transaction atomically:
  1. Transitions new instrument to `ACTIVE`.
  2. Transitions old instrument to `RENEWED`.
  3. Creates `RenewalLink` with `renewed_after_maturity` flag (capturing if old instrument was already expired).
  4. Auto-resolves all pending alerts on the old instrument.
- **Lineage Tree**: `GET /instruments/{id}/lineage` recursively traverses `replaces_instrument_id` ancestors and `replaced_by` descendants, providing full audit visibility of the renewal chain.



---

## Phase 5: Release & Refund Workflow, Dashboard Analytics, and Reporting Engine

### 1. Final State Machine
```mermaid
stateDiagram-v2
    [*] --> SUBMITTED
    SUBMITTED --> UNDER_SCRUTINY
    UNDER_SCRUTINY --> DISCREPANCY
    DISCREPANCY --> SUBMITTED
    UNDER_SCRUTINY --> VERIFIED
    VERIFIED --> ACTIVE

    ACTIVE --> EXPIRING : maturity in <= 90 days
    ACTIVE --> MATURED : maturity < today
    EXPIRING --> MATURED : maturity < today

    ACTIVE --> RENEWED : renewal activated
    EXPIRING --> RENEWED : renewal activated
    MATURED --> RENEWED : renewal activated

    ACTIVE --> RELEASE_REQUESTED : release/refund requested
    EXPIRING --> RELEASE_REQUESTED : release/refund requested
    MATURED --> RELEASE_REQUESTED : release/refund requested

    RELEASE_REQUESTED --> RELEASED : approved by Approver
    RELEASE_REQUESTED --> ACTIVE : rejected/withdrawn (if from ACTIVE)
    RELEASE_REQUESTED --> EXPIRING : rejected/withdrawn (if from EXPIRING)
    RELEASE_REQUESTED --> MATURED : rejected/withdrawn (if from MATURED)

    RENEWED --> [*] : Terminal State
    RELEASED --> [*] : Terminal State
```

### 2. Multi-Level Release & Approval Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Inst as Institution
    actor Officer as Verifying Officer
    actor Approver as Approving Authority
    participant API as FastAPI Router
    participant RelSvc as ReleaseService
    participant CondSvc as ReleaseConditions
    participant State as InstrumentState
    participant Closure as ClosureService
    participant MinIO as Encrypted Storage
    participant DB as PostgreSQL

    Inst->>API: POST /instruments/{id}/release-requests
    API->>RelSvc: create_release_request(data)
    RelSvc->>CondSvc: evaluate_automatic_conditions()
    CondSvc-->>RelSvc: all mandatory auto conditions pass
    RelSvc->>State: transition(ACTIVE -> RELEASE_REQUESTED)
    RelSvc->>DB: INSERT release_requests (status=PENDING, encrypted beneficiary)
    RelSvc-->>API: 201 Created

    Officer->>API: POST /release-requests/{id}/start-review
    API->>RelSvc: start_review()
    RelSvc->>DB: UPDATE status=UNDER_REVIEW

    Officer->>API: POST /release-requests/{id}/conditions
    API->>RelSvc: record_conditions(results)
    RelSvc->>DB: UPSERT release_condition_results

    Officer->>API: POST /release-requests/{id}/recommend
    API->>RelSvc: recommend(recommendation=RECOMMEND)
    RelSvc->>DB: UPDATE recommended_by, recommended_at, notes

    Approver->>API: POST /release-requests/{id}/approve
    API->>RelSvc: approve()
    Note over RelSvc: Segregation of Duties Check: Approver != Recommender. ADMIN barred.
    RelSvc->>Closure: create_closure_document()
    Closure->>MinIO: Put encrypted PDF with SHA-256 verification stamp
    RelSvc->>DB: INSERT documents (doc_type=CLOSURE)
    RelSvc->>State: transition(RELEASE_REQUESTED -> RELEASED)
    RelSvc->>DB: UPDATE release_requests (status=CLOSED, closure_document_id)
    RelSvc->>DB: auto_resolve_alerts(reason="released")
    RelSvc-->>API: Release Complete & Audited
```

### 3. Shared Filter Layer (`services/instrument_filters.py`)
- Provides a centralized `InstrumentFilter` model (`extra="forbid"`) and `build_query()` generator.
- All query parameters use parameterized SQLAlchemy expressions with whitelisted columns and comparison operators, preventing SQL injection.
- **Tenant Isolation**: `scope_to_institution(query, user, Instrument)` is unconditionally applied as the final filter barrier. An institution user can never widen their query scope.
- Reusable `missing_documents(instrument)` helper evaluates required uploads across filters, queue management, and dashboards.

### 4. High-Performance Dashboard Analytics & Redis Caching
- **Raw SQL Aggregation**: Metrics are computed in single-query aggregates with `group_by` and conditional `sum`/`count`, avoiding N+1 roundtrips.
- **Cache-Aside Architecture**: Cached with Redis TTL (default 60s). Cache keys strictly isolate tenant and role:
  `dashboard:{endpoint}:{role}:{institution_id or 'all'}:{param_hash}`
- **Failover Guarantee**: Gracefully falls back to real-time database queries if Redis is unavailable.

### 5. Multi-Format Reporting Engine (`services/reports/`)
- Unified `ReportRegistry` managing 8 specialized reports: `pending-verifications`, `upcoming-maturities`, `missing-documents`, `cases-needing-intervention`, `release-pipeline`, `institution-statement`, `renewal-history`, and `my-instruments`.
- **Injection Sanitization**: All cells starting with `=`, `+`, `-`, or `@` are sanitized with leading apostrophes to protect downstream spreadsheet applications.
- **Styling**: OpenPyXL workbooks styled with official AICTE palette (`#1B365D`), frozen header panes, and dedicated audit metadata sheets.
- **Streaming & Truncation**: Streaming response capped at 50,000 rows with `X-Report-Truncated` notification headers.
- **Auditability**: Every export event writes a hash-chained audit record.

---

## Phase CR: Multi-Instrument & Central Document Registry

### 1. Instrument Types (`FDR` & `BANK_GUARANTEE`)
The portal models both Fixed Deposit Receipts and Bank Guarantees with shared lifecycle transitions and type-specific constraints:
- **Bank Guarantee Core Fields**:
  - `claim_expiry_date`: Mandated claim lodgement deadline, constrained at database level to be $\ge \text{maturity\_date}$ (`ck_instrument_bg_claim_expiry`). Recommended $\ge 30$ days beyond maturity.
  - `beneficiary_name`: Beneficiary organization, defaults to `"AICTE"`.
  - `reference_number`: Serves as the Guarantee Reference Number.

### 2. Central Document Registry (`core/document_registry.py`)
Single source of truth for all operational documents:
- Seven registered types:
  1. `FDR_SCAN`: Original FDR Certificate (Mandatory for FDR).
  2. `BANK_GUARANTEE_DOCUMENT`: Original Bank Guarantee Document (Mandatory for BG).
  3. `DEPOSIT_CONFIRMATION`: Bank Deposit Confirmation Slip (Mandatory for FDR).
  4. `BANK_LETTER`: Bank Confirmation & Lien Letter (Mandatory for BG, optional for FDR).
  5. `RENEWAL_CERTIFICATE`: Renewal FDR / BG Extension Certificate (Mandatory on renewal).
  6. `CLOSURE`: Discharge & Release Certificate (Generated by AICTE on `RELEASED`).
  7. `OTHER`: Fallback attachment.
- Exposed via public endpoint: `GET /meta/document-types`.
- Drives UI upload slots, backend validation, missing document queries, and OCR profiles without hardcoded enums.

### 3. AI/ML Pipeline Integration
- **OCR Profiles**: Per-document-type extraction profiles for `BANK_GUARANTEE_DOCUMENT` (guarantee number, bank, amount, issue/maturity/claim dates, beneficiary) and `RENEWAL_CERTIFICATE`.
- **Cross-Document Consistency**: Type-aware cross-check:
  - For FDR: `FDR_SCAN` vs. `DEPOSIT_CONFIRMATION` vs. `BANK_LETTER`.
  - For Bank Guarantee: `BANK_GUARANTEE_DOCUMENT` vs. `BANK_LETTER`.
- **Trust Score**: Document completeness and date consistency factors dynamically adapt based on instrument type.
- **Natural Language Search**: Detects `instrument_types` ("bank guarantee", "bg", "fdr") and specific `missing_doc_types`.
