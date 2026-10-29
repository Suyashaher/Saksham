-- =============================================================================
-- AICTE FDR & Security Deposit Management Portal
-- Complete Database Initialization & Seed Script for Supabase / PostgreSQL 16
-- Run directly in the Supabase SQL Editor (New Query -> Paste -> Run)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Create Alembic Migration Tracking ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('005');

-- ── 2. Create PostgreSQL ENUM Types ──────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fdrstatus') THEN
        CREATE TYPE fdrstatus AS ENUM (
            'SUBMITTED', 'UNDER_SCRUTINY', 'VERIFIED', 'DISCREPANCY',
            'ACTIVE', 'EXPIRING', 'MATURED', 'RENEWED',
            'RELEASE_REQUESTED', 'RELEASED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verificationtag') THEN
        CREATE TYPE verificationtag AS ENUM ('SELF_DECLARED', 'BANK_VERIFIED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        CREATE TYPE userrole AS ENUM ('INSTITUTION', 'VERIFYING_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verificationmethod') THEN
        CREATE TYPE verificationmethod AS ENUM ('API', 'QR', 'LETTER');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'releaserequeststatus') THEN
        CREATE TYPE releaserequeststatus AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'officerverdict') THEN
        CREATE TYPE officerverdict AS ENUM ('CORRECT', 'INCORRECT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alertruletype') THEN
        CREATE TYPE alertruletype AS ENUM (
            'MATURITY_REMINDER', 'OVERDUE_MATURED', 'STALE_VERIFICATION',
            'DISCREPANCY_UNRESOLVED', 'RELEASE_PENDING'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alertstatus') THEN
        CREATE TYPE alertstatus AS ENUM ('PENDING', 'SENT', 'FAILED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'releaserequesttype') THEN
        CREATE TYPE releaserequesttype AS ENUM ('RELEASE', 'REFUND');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'officerrecommendation') THEN
        CREATE TYPE officerrecommendation AS ENUM ('RECOMMEND', 'NOT_RECOMMEND');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conditionresultenum') THEN
        CREATE TYPE conditionresultenum AS ENUM ('PASS', 'FAIL', 'NOT_APPLICABLE');
    END IF;
END $$;

-- ── 3. Create Core Tables ────────────────────────────────────────────────────

-- Institutions
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    aicte_id VARCHAR(50) NOT NULL UNIQUE,
    state VARCHAR(100) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    approval_cycle VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_institutions_aicte_id ON institutions(aicte_id);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    full_name VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role userrole NOT NULL,
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- Instruments (FDRs)
CREATE TABLE IF NOT EXISTS instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    reference_number VARCHAR(100) NOT NULL UNIQUE,
    issuing_bank VARCHAR(255) NOT NULL,
    branch VARCHAR(255),
    amount NUMERIC(14, 2) NOT NULL,
    required_amount NUMERIC(14, 2),
    issue_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    validity_status VARCHAR(50),
    verification_tag verificationtag NOT NULL DEFAULT 'SELF_DECLARED',
    status fdrstatus NOT NULL DEFAULT 'SUBMITTED',
    replaces_instrument_id UUID REFERENCES instruments(id) ON DELETE SET NULL,
    validation_flags JSONB,
    assigned_officer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status_before_release_request VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT ck_instrument_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_instrument_maturity_after_issue CHECK (maturity_date > issue_date)
);
CREATE INDEX IF NOT EXISTS ix_instrument_reference_number ON instruments(reference_number);
CREATE INDEX IF NOT EXISTS ix_instrument_maturity_date ON instruments(maturity_date);
CREATE INDEX IF NOT EXISTS ix_instrument_status ON instruments(status);
CREATE INDEX IF NOT EXISTS ix_instrument_institution_id ON instruments(institution_id);
CREATE INDEX IF NOT EXISTS ix_instrument_issuing_bank ON instruments(issuing_bank);
CREATE INDEX IF NOT EXISTS ix_instrument_status_maturity ON instruments(status, maturity_date);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    doc_type VARCHAR(100) NOT NULL,
    storage_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification Records
CREATE TABLE IF NOT EXISTS verification_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    method verificationmethod NOT NULL,
    result TEXT NOT NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    discrepancy_notes TEXT
);

-- Renewal Links
CREATE TABLE IF NOT EXISTS renewal_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    old_instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    new_instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    renewed_after_maturity BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_renewal_link_pair UNIQUE (old_instrument_id, new_instrument_id)
);

-- Release Requests
CREATE TABLE IF NOT EXISTS release_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status releaserequeststatus NOT NULL DEFAULT 'PENDING',
    request_type releaserequesttype NOT NULL DEFAULT 'RELEASE',
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recommended_by UUID REFERENCES users(id) ON DELETE SET NULL,
    recommended_at TIMESTAMPTZ,
    officer_recommendation officerrecommendation,
    officer_notes TEXT,
    withdrawn_at TIMESTAMPTZ,
    beneficiary_details TEXT,
    decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    decision_notes TEXT,
    closure_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_release_request_per_instrument
    ON release_requests (instrument_id)
    WHERE status IN ('PENDING', 'UNDER_REVIEW');

-- Alert Rules
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    rule_type alertruletype NOT NULL,
    days INT NOT NULL,
    channels VARCHAR(20)[] NOT NULL DEFAULT '{}',
    recipient_role userrole NOT NULL,
    escalate_after_days INT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    scheduled_for DATE,
    sent_at TIMESTAMPTZ,
    escalation_level INT NOT NULL DEFAULT 0,
    status alertstatus NOT NULL DEFAULT 'PENDING',
    failure_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_reason VARCHAR(500),
    parent_alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    CONSTRAINT ck_alert_escalation_level CHECK (escalation_level >= 0 AND escalation_level <= 2),
    CONSTRAINT uq_alert_idempotency UNIQUE (instrument_id, rule_id, recipient_user_id, channel, scheduled_for, escalation_level)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);

-- Audit Logs (Hash-Chained & Immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prev_hash TEXT,
    hash TEXT
);

-- Audit log append-only triggers
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % not allowed', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Instrument Status History
CREATE TABLE IF NOT EXISTS instrument_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    from_status fdrstatus,
    to_status fdrstatus NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_status_history_instrument_id ON instrument_status_history(instrument_id);

-- Scrutiny Observations
CREATE TABLE IF NOT EXISTS scrutiny_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    observer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_observations_instrument_id ON scrutiny_observations(instrument_id);

-- Mock Bank Registry (For branch verification matching)
CREATE TABLE IF NOT EXISTS mock_bank_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    issuing_bank VARCHAR(255) NOT NULL,
    branch VARCHAR(255),
    amount NUMERIC(14, 2) NOT NULL,
    issue_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    holder_name VARCHAR(255) NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT true
);

-- Release Conditions Catalog
CREATE TABLE IF NOT EXISTS release_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    is_automatic BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    applies_to_request_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_release_conditions_code ON release_conditions(code);

-- Release Condition Results
CREATE TABLE IF NOT EXISTS release_condition_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES release_requests(id) ON DELETE CASCADE,
    condition_id UUID NOT NULL REFERENCES release_conditions(id) ON DELETE CASCADE,
    result conditionresultenum NOT NULL,
    checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_auto BOOLEAN NOT NULL DEFAULT false,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT,
    CONSTRAINT uq_condition_result_per_request UNIQUE (request_id, condition_id)
);
CREATE INDEX IF NOT EXISTS ix_condition_result_request ON release_condition_results(request_id);

-- Auth & Security Supporting Tables
CREATE TABLE IF NOT EXISTS otp_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_otp_challenges_user_created ON otp_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti VARCHAR(255) NOT NULL UNIQUE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_revoked ON refresh_tokens(user_id, is_revoked);

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_failed_login_email_time ON failed_login_attempts(email, attempted_at);

CREATE TABLE IF NOT EXISTS feedback_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_feature VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    ai_output JSONB,
    officer_verdict officerverdict NOT NULL,
    labelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ── 4. Seed Data (Accounts, Institutions, Bank Data, Rules, Conditions) ────────

-- SYSTEM User (Required for background jobs and audit transitions)
INSERT INTO users (id, email, full_name, hashed_password, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'system@fdr-portal.internal',
    'FDR Portal System',
    '!DISABLED!',
    'ADMIN',
    false
) ON CONFLICT (email) DO NOTHING;

-- Accredited Institutions
INSERT INTO institutions (id, name, aicte_id, state, contact_email, contact_phone, approval_cycle)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Delhi Technological University', '1-DTU-DELHI', 'Delhi', 'contact@dtu.ac.in', '011-27871018', '2025-2026'),
    ('22222222-2222-2222-2222-222222222222', 'College of Engineering Pune', '1-COEP-PUNE', 'Maharashtra', 'contact@coep.ac.in', '020-25507000', '2025-2026')
ON CONFLICT (aicte_id) DO NOTHING;

-- Seed User Accounts (Passwords pre-hashed with Bcrypt)
-- Passwords:
-- Admin: Admin@AICTE2026!
-- Officer: Officer@AICTE2026!
-- Approver: Approver@AICTE2026!
-- Inst1: Inst1@AICTE2026!
-- Inst2: Inst2@AICTE2026!
INSERT INTO users (id, email, full_name, hashed_password, role, institution_id, phone, is_active)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'admin@aicte.gov.in', 'AICTE Super Admin', '$2b$12$BAy8doKA64js7b.1CwKPsuzKMF2.zz1GyG5vdihGNEzDCJuJiZlNO', 'ADMIN', NULL, '9999900001', true),
    ('a0000000-0000-0000-0000-000000000002', 'officer@aicte.gov.in', 'Verifying Officer Sharma', '$2b$12$s0n.dYNDj7J349hhslOBtu5UlGRSV1V4HMo/D6of393NrszYYACK.', 'VERIFYING_OFFICER', NULL, '9999900002', true),
    ('a0000000-0000-0000-0000-000000000003', 'approver@aicte.gov.in', 'Bureau Head Verma', '$2b$12$cPvcAQg77.QtHHchCKNVV.Q4ppjq4W39Vs.Y.xg5rBHPHFKaXMPui', 'APPROVING_AUTHORITY', NULL, '9999900003', true),
    ('a0000000-0000-0000-0000-000000000004', 'registrar@dtu.ac.in', 'DTU Registrar', '$2b$12$nImQ1yWZmjcl20gnCbCjjunzlCmuZJAFAItgFpQJPL4Kl0kypluLe', 'INSTITUTION', '11111111-1111-1111-1111-111111111111', '9999900004', true),
    ('a0000000-0000-0000-0000-000000000005', 'registrar@coep.ac.in', 'COEP Registrar', '$2b$12$l4toNVvwvWT/xuKdJIXi3.6Jb6bKuQUh7f7y3HAV1gY.f7j6hyV..', 'INSTITUTION', '22222222-2222-2222-2222-222222222222', '9999900005', true)
ON CONFLICT (email) DO UPDATE SET
    hashed_password = EXCLUDED.hashed_password,
    is_active = EXCLUDED.is_active;

-- Mock Bank Registry Records (For automated verification comparisons)
INSERT INTO mock_bank_registry (reference_number, issuing_bank, branch, amount, issue_date, maturity_date, holder_name, is_valid)
VALUES
    ('FDR-SBI-2025-001', 'State Bank of India', 'Parliament Street, New Delhi', 2500000.00, '2025-01-15', '2028-01-15', 'Delhi Technological University', true),
    ('FDR-PNB-2025-002', 'Punjab National Bank', 'Connaught Place, New Delhi', 1500000.00, '2025-03-01', '2028-03-01', 'College of Engineering Pune', true),
    ('FDR-BOB-2025-003', 'Bank of Baroda', 'MG Road, Mumbai', 3000000.00, '2025-06-01', '2028-06-01', 'IIT Bombay', true),
    ('FDR-SBI-2025-MISMATCH', 'State Bank of India', 'Nehru Place, New Delhi', 2000000.00, '2025-02-01', '2028-02-01', 'Test Mismatch College', true)
ON CONFLICT (reference_number) DO NOTHING;

-- Default Alert Rules
INSERT INTO alert_rules (name, rule_type, days, channels, recipient_role, escalate_after_days, is_active)
VALUES
    ('Maturity Reminder 90 Days (Institution)', 'MATURITY_REMINDER', 90, ARRAY['EMAIL', 'IN_APP'], 'INSTITUTION', NULL, true),
    ('Maturity Reminder 60 Days (Institution)', 'MATURITY_REMINDER', 60, ARRAY['EMAIL', 'IN_APP'], 'INSTITUTION', NULL, true),
    ('Maturity Reminder 30 Days (Institution)', 'MATURITY_REMINDER', 30, ARRAY['EMAIL', 'SMS', 'IN_APP'], 'INSTITUTION', NULL, true),
    ('Maturity Reminder 7 Days (Institution)', 'MATURITY_REMINDER', 7, ARRAY['EMAIL', 'SMS', 'IN_APP'], 'INSTITUTION', NULL, true),
    ('Overdue Matured Daily Alert', 'OVERDUE_MATURED', 1, ARRAY['EMAIL', 'IN_APP'], 'INSTITUTION', 3, true),
    ('Stale Verification Scrutiny Alert', 'STALE_VERIFICATION', 5, ARRAY['EMAIL', 'IN_APP'], 'VERIFYING_OFFICER', NULL, true),
    ('Unresolved Discrepancy Alert', 'DISCREPANCY_UNRESOLVED', 7, ARRAY['EMAIL', 'IN_APP'], 'INSTITUTION', NULL, true)
ON CONFLICT (name) DO NOTHING;

-- Default Statutory Release Conditions
INSERT INTO release_conditions (code, description, is_mandatory, is_automatic, is_active)
VALUES
    ('INSTRUMENT_BANK_VERIFIED', 'Instrument has been independently verified with the issuing bank branch records', true, true, true),
    ('NO_OPEN_RENEWAL', 'No ongoing or incomplete replacement/renewal instrument is pending against this deposit', true, true, true),
    ('NO_ACTIVE_DISCREPANCY', 'All scrutiny discrepancies and audit observations have been resolved by the institution', true, true, true),
    ('MINIMUM_TENURE_COMPLETED', 'Course tenure or approved statutory period has concluded without regulatory sanctions', true, false, true),
    ('REGIONAL_OFFICE_NOC', 'No-Objection Certificate issued by the jurisdictional AICTE Regional Office', true, false, true),
    ('STUDENT_FEE_REFUND_CLEARANCE', 'Affidavit confirming no pending student caution money or excess fee refund grievances', false, false, true)
ON CONFLICT (code) DO NOTHING;

-- Sample Initial FDR Instruments (DTU & COEP)
INSERT INTO instruments (
    id, institution_id, reference_number, issuing_bank, branch, amount, required_amount,
    issue_date, maturity_date, validity_status, verification_tag, status
)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'FDR-SBI-2025-001',
        'State Bank of India',
        'Parliament Street, New Delhi',
        2500000.00,
        2500000.00,
        '2025-01-15',
        '2028-01-15',
        'VALID',
        'BANK_VERIFIED',
        'ACTIVE'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'FDR-HDFC-2024-089',
        'HDFC Bank',
        'Rohini Sector 14, Delhi',
        1500000.00,
        1500000.00,
        '2024-05-10',
        '2026-11-20',
        'EXPIRING_SOON',
        'BANK_VERIFIED',
        'EXPIRING'
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        '22222222-2222-2222-2222-222222222222',
        'FDR-PNB-2025-002',
        'Punjab National Bank',
        'Connaught Place, New Delhi',
        1500000.00,
        1500000.00,
        '2025-03-01',
        '2028-03-01',
        'VALID',
        'BANK_VERIFIED',
        'ACTIVE'
    ),
    (
        'b0000000-0000-0000-0000-000000000004',
        '11111111-1111-1111-1111-111111111111',
        'FDR-ICICI-2026-901',
        'ICICI Bank',
        'Connaught Place, New Delhi',
        1000000.00,
        1000000.00,
        '2026-09-01',
        '2029-09-01',
        'PENDING_SCRUTINY',
        'SELF_DECLARED',
        'SUBMITTED'
    )
ON CONFLICT (reference_number) DO NOTHING;

-- Initial Genesis Audit Entry
INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, payload, created_at, prev_hash, hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'system_genesis',
    'system',
    '00000000-0000-0000-0000-000000000002',
    '{"message": "Genesis initial audit log entry sealed", "environment": "production"}'::jsonb,
    now(),
    '0000000000000000000000000000000000000000000000000000000000000000',
    'GENESIS-FDR-PORTAL-v1'
) ON CONFLICT (id) DO NOTHING;
