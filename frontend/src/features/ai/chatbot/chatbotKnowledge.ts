export type ChatbotMode = 'compliance' | 'explainable';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  mode: ChatbotMode;
  text: string;
  timestamp: string;
  metadata?: {
    title?: string;
    badge?: {
      text: string;
      variant: 'success' | 'warning' | 'info' | 'danger';
    };
    metrics?: Array<{ label: string; value: string }>;
    links?: Array<{ label: string; href: string }>;
    factorBreakdown?: Array<{
      factor: string;
      weight: string;
      score: string;
      contribution: string;
      status: 'positive' | 'warning' | 'neutral';
    }>;
  };
}

export interface PresetPrompt {
  id: string;
  label: string;
  query: string;
  mode: ChatbotMode;
  category: string;
}

export const PRESET_PROMPTS: Record<ChatbotMode, PresetPrompt[]> = {
  compliance: [
    {
      id: 'dtu-status',
      label: 'DTU Compliance Status',
      query: 'What is Delhi Technological University (DTU) deposit compliance status?',
      mode: 'compliance',
      category: 'Institution Health',
    },
    {
      id: 'coep-release',
      label: 'COEP Release Eligibility',
      query: 'Is College of Engineering Pune (COEP) eligible for FDR release or refund?',
      mode: 'compliance',
      category: 'Release & Refund',
    },
    {
      id: 'fdr-norms-2026',
      label: 'AICTE Mandatory FDR Norms',
      query: 'What are the official AICTE mandatory FDR deposit norms for 2026-27?',
      mode: 'compliance',
      category: 'Regulatory Guidelines',
    },
    {
      id: 'overdue-renewals',
      label: 'Overdue Renewals List',
      query: 'Which institutions currently have overdue or maturing FDR renewals?',
      mode: 'compliance',
      category: 'Maturity Tracking',
    },
    {
      id: 'shortfall-action',
      label: 'Shortfall Calculation & Penalties',
      query: 'How is deposit shortfall calculated and what regulatory actions follow?',
      mode: 'compliance',
      category: 'Enforcement',
    },
    {
      id: 'replacement-fdr',
      label: 'Submit Replacement FDR',
      query: 'How does an institution submit a replacement FDR for an expiring deposit?',
      mode: 'compliance',
      category: 'Renewal Process',
    },
    {
      id: 'release-checklist',
      label: 'Release Documents Checklist',
      query: 'What documents are required to apply for security deposit release or refund?',
      mode: 'compliance',
      category: 'Release & Refund',
    },
    {
      id: 'bank-merger',
      label: 'Bank Merger / IFSC Change',
      query: 'What is the procedure if the issuing bank is merged or changes IFSC code?',
      mode: 'compliance',
      category: 'Bank Operations',
    },
    {
      id: 'mutual-funds-bonds',
      label: 'Mutual Funds Admissibility',
      query: 'Can an institution pledge mutual funds, shares, or corporate bonds instead of an FDR?',
      mode: 'compliance',
      category: 'Eligibility Rules',
    },
    {
      id: 'premature-penalty',
      label: 'Premature FDR Encashment',
      query: 'What is the penalty if an institution prematurely encashes a joint FDR without approval?',
      mode: 'compliance',
      category: 'Statutory Penalties',
    },
    {
      id: 'track-verification',
      label: 'Track Verification Status',
      query: 'How can an institution track the verification stages of a newly uploaded FDR?',
      mode: 'compliance',
      category: 'Workflow Tracking',
    },
    {
      id: 'govt-vs-pvt-norms',
      label: 'Govt vs Private Norms',
      query: 'Are security deposit norms different for Government institutions versus Private colleges?',
      mode: 'compliance',
      category: 'Policy Distinction',
    },
  ],
  explainable: [
    {
      id: 'trust-score-72',
      label: 'Why Trust Score 72 on FDR-SBI?',
      query: 'Why does instrument FDR-SBI-2025-001 have an AI Trust Score of 72?',
      mode: 'explainable',
      category: 'Trust Scoring',
    },
    {
      id: 'turnaround-pred',
      label: 'Turnaround Prediction Engine',
      query: 'Explain how turnaround prediction calculates 4.2 days for Under Scrutiny.',
      mode: 'explainable',
      category: 'Predictions',
    },
    {
      id: 'ocr-mismatch',
      label: 'OCR Mismatch Root Cause',
      query: 'What caused the OCR mismatch discrepancy flag on the Axis Bank certificate?',
      mode: 'explainable',
      category: 'Discrepancy Detection',
    },
    {
      id: 'weights-calibration',
      label: '10-Factor Weight Calibration',
      query: 'How are the 10 mathematical factor weights calibrated in Champion Model v2.4?',
      mode: 'explainable',
      category: 'Model Governance',
    },
    {
      id: 'ai-invariants',
      label: '5 Ethical AI Invariants',
      query: 'What are the 5 ethical AI governance invariants enforced in Saksham?',
      mode: 'explainable',
      category: 'Ethics & Governance',
    },
    {
      id: 'suspect-doc-type',
      label: 'Suspect Doc Type Warning',
      query: 'Why did the AI trigger a SUSPECT_DOC_TYPE flag on the uploaded receipt?',
      mode: 'explainable',
      category: 'Discrepancy Detection',
    },
    {
      id: 'ifsc-geo-match',
      label: 'IFSC & Geolocation Matching',
      query: 'How does the AI verify issuing branch IFSC codes and geographic radius?',
      mode: 'explainable',
      category: 'Verification Logic',
    },
    {
      id: 'fast-track-criteria',
      label: 'Fast-Track Criteria (Score > 85)',
      query: 'What specific parameters qualify an instrument for Fast-Track Verification (Score > 85)?',
      mode: 'explainable',
      category: 'Trust Scoring',
    },
    {
      id: 'active-learning-feedback',
      label: 'Active Learning Feedback Loop',
      query: 'How does officer feedback retrain the OCR extraction and Trust Scoring models?',
      mode: 'explainable',
      category: 'Model Lifecycle',
    },
    {
      id: 'at-risk-sla-prediction',
      label: 'At-Risk SLA Warning Logic',
      query: 'What factors cause the turnaround prediction engine to flag an At-Risk SLA warning?',
      mode: 'explainable',
      category: 'Predictions',
    },
    {
      id: 'approver-override-audit',
      label: 'Approver Override & Audit',
      query: 'Can an Approver override an AI discrepancy flag, and how is it audited?',
      mode: 'explainable',
      category: 'Governance Invariants',
    },
    {
      id: 'cross-doc-3way',
      label: '3-Way Document Consistency',
      query: 'Explain how the 3-Way Cross-Document Consistency score is computed.',
      mode: 'explainable',
      category: 'Verification Logic',
    },
  ],
};

export const INITIAL_GREETINGS: Record<ChatbotMode, ChatMessage> = {
  compliance: {
    id: 'welcome-compliance',
    sender: 'assistant',
    mode: 'compliance',
    timestamp: 'Just now',
    text: `Welcome to **Institutional Compliance Intelligence**. 

I analyze institutional deposit portfolios, statutory lock-in periods, mandatory tripartite FDR requirements, replacement procedures, and automated compliance risk across technical institutions.

Select any quick topic below or type your compliance, renewal, or release query:`,
    metadata: {
      badge: {
        text: 'Module 4: Compliance Intelligence Active',
        variant: 'info',
      },
    },
  },
  explainable: {
    id: 'welcome-explainable',
    sender: 'assistant',
    mode: 'explainable',
    timestamp: 'Just now',
    text: `Welcome to **Explainable AI Assistance** *(Verifying Officers & Approvers Console)*. 

I provide mathematical transparency into Saksham's predictive models. I can break down 10-factor Trust Scores, explain why OCR discrepancies or suspect document types were flagged, unpack turnaround predictions, and clarify model weight calibration.

Select an analysis below or ask why any automated score or discrepancy was generated:`,
    metadata: {
      badge: {
        text: 'Module 5: Explainable AI Engine Active (Officers & Approvers)',
        variant: 'info',
      },
    },
  },
};

/**
 * Intelligent Mock Knowledge Responder
 */
export function generateChatbotReply(query: string, mode: ChatbotMode): ChatMessage {
  const q = query.toLowerCase();
  const id = `reply-${Date.now()}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // -------------------------------------------------------------
  // MODE: COMPLIANCE INTELLIGENCE
  // -------------------------------------------------------------
  if (mode === 'compliance') {
    // 1. DTU
    if (q.includes('dtu') || q.includes('delhi technological') || q.includes('डीटीयू') || q.includes('दिल्ली')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Institutional Compliance Assessment: Delhi Technological University (DTU)

**Institution Code:** \`AICTE-1-1029384\` | **Region:** North-West (New Delhi)  
**Affiliation Type:** State Government University | **Accreditation:** NAAC A+

#### Deposit Portfolio Status:
- **Mandatory Required Security Deposit:** ₹50,00,000 (₹50.00 Lakhs)
- **Active Valid FDRs Lodged:** ₹50,00,000 across 2 instruments
- **Shortfall:** ₹0.00 (**Zero Shortfall • 100% Compliant**)
- **Issuing Bank:** State Bank of India, Parliament Street Branch
- **Lien Status:** Irrevocable joint lien endorsed in favour of Member Secretary, AICTE.

#### Maturity & Lock-In Profile:
- **Primary Instrument (\`FDR-SBI-2025-001\`):** ₹35,00,000 | Matures: **15 Jan 2028** (Safe: >700 days remaining).
- **Secondary Instrument (\`FDR-SBI-2025-002\`):** ₹15,00,000 | Matures: **15 Jan 2028**.
- **Auto-Renewal Tripartite Clause:** Active and verified with SBI nodal portal.

**Advisory Recommendation:** DTU is fully compliant with AICTE Approval Process Handbook (APH) regulations. No compliance notices required.`,
        metadata: {
          badge: { text: 'COMPLIANT (100%)', variant: 'success' },
          metrics: [
            { label: 'Required Deposit', value: '₹50,00,000' },
            { label: 'Verified Lodged', value: '₹50,00,000' },
            { label: 'Shortfall', value: '₹0.00' },
            { label: 'Lien Endorsement', value: 'Verified' },
          ],
          links: [
            { label: 'View DTU in Institutions Directory', href: '/admin/institutions' },
            { label: 'Inspect Active Instruments', href: '/instruments' },
          ],
        },
      };
    }

    // 2. COEP
    if (q.includes('coep') || q.includes('pune') || q.includes('college of engineering pune') || q.includes('सीओईपी') || q.includes('पुणे')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Release & Refund Eligibility Audit: College of Engineering Pune (COEP)

**Institution Code:** \`AICTE-1-9876543\` | **Region:** Western (Maharashtra)  
**Status:** Autonomous State University

#### Statutory Prerequisite Verification:
1. **Tenure & Lock-in Completion (10 Years):** **SATISFIED** (Instruments maintained in joint lien since 2014).
2. **Student Complaints & Grievance Clearances:** **CLEARED** (Zero pending matters before AICTE Ombudsman).
3. **Court Injunctions or Liens:** **NONE** (Clear title confirmed by Maharashtra DTE).
4. **Physical Original Receipt Surrender:** **SUBMITTED** with branch discharge receipt.
5. **Three-Way Bank Release Undertaking:** **RECEIVED** from Bank of Maharashtra, Shivajinagar Branch.

#### Release Quantum Determination:
- **Total Principal under Joint Custody:** ₹35,00,000.
- **Accrued Interest Payout:** Directly payable to institution upon lien discharge.
- **Statutory Release Clearance:** **Eligible for Full Discharge & Lien Revocation**.

**Advisory Recommendation:** All statutory conditions are satisfied. Approving Authority can proceed with digital signing of the Release Discharge Order.`,
        metadata: {
          badge: { text: 'ELIGIBLE FOR RELEASE', variant: 'success' },
          metrics: [
            { label: 'Lock-in Status', value: 'Completed (10y)' },
            { label: 'Eligible Quantum', value: '₹35,00,000' },
            { label: 'Pending Grievances', value: '0' },
            { label: 'DTE Clearance', value: 'Verified' },
          ],
          links: [
            { label: 'Open Release Request Console', href: '/approvals' },
            { label: 'View Release Conditions Matrix', href: '/admin/release-conditions' },
          ],
        },
      };
    }

    // 3. Mandatory Norms 2026
    if (q.includes('norm') || q.includes('rule') || q.includes('2026') || q.includes('handbook') || q.includes('aph')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### AICTE Statutory Security Deposit Norms (APH 2026-27 Summary)

Under the AICTE Approval Process Handbook (Regulations Bureau), every technical institution must establish an irrevocable joint Fixed Deposit Receipt (FDR) with AICTE before admitting students:

#### 1. Deposit Quantum by Program Category:
- **Technical & Engineering (UG):** ₹35,00,000 to ₹50,00,000 (depending on sanctioned division intake).
- **Postgraduate Programs (MBA/MCA):** ₹15,00,000 to ₹25,00,000 per program.
- **Pharmacy & Architecture:** ₹25,00,000 to ₹35,00,000.
- **Polytechnic / Diploma:** ₹15,00,000 to ₹20,00,000.

#### 2. Mandatory Structural Invariants:
- **Tenure:** Fixed lock-in of **minimum 8 to 10 years**.
- **Beneficiary Format:** Strictly drawn as *" [Institution Name] & Regional Officer, AICTE"*.
- **Eligible Banks:** Any Scheduled Commercial Bank regulated by the Reserve Bank of India (Public Sector, Top-Tier Private, or Regional Rural Banks).
- **Tripartite Auto-Renewal Clause:** Mandatory commitment from issuing branch to auto-renew upon maturity unless an official lien revocation letter signed by AICTE Approving Authority is presented.

#### 3. Penal Provisions for Non-Compliance:
- Withholding of annual Extension of Approval (EoA).
- Freeze on portal enrollment seats.
- Forfeiture of security deposit in cases of premature closure without teach-out compliance.`,
        metadata: {
          badge: { text: 'APH 2026-27 NORMS', variant: 'info' },
          metrics: [
            { label: 'Lock-in Period', value: '8 - 10 Years' },
            { label: 'Joint Beneficiary', value: 'Mandatory' },
            { label: 'Auto-Renewal', value: 'Tripartite' },
            { label: 'Bank Eligibility', value: 'RBI Scheduled' },
          ],
        },
      };
    }

    // 4. Overdue Renewals
    if (q.includes('overdue') || q.includes('matur') || q.includes('renew') && q.includes('list')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Real-Time Maturity & Renewal Liability Pipeline

Current monitoring across all active technical education institutions in Saksham:

#### Action Priority Breakdown:
1. **Critical Overdue (>30 Days Past Maturity):** **3 Institutions**
   - *Vidya Sagar Institute of Tech (AICTE-1-4455221)* — ₹25L (Canara Bank, Expired 45 days ago)
   - *Apex College of Management (AICTE-1-7788112)* — ₹15L (Punjab National Bank, Expired 32 days ago)
   - *Himalayan Polytechnic (AICTE-1-9922334)* — ₹20L (Bank of Baroda, Expired 31 days ago)
   - **Enforcement Status:** Automated regulatory reminder 3 dispatched; escalated to Regional Officer queue.

2. **Immediate Urgency (<30 Days to Maturity):** **5 Instruments** (Total value: ₹1.45 Cr)
   - Automated 30-day notice sent via registered email and SMS to Registrars.

3. **Upcoming Pipeline (31 to 90 Days):** **12 Instruments** (Total value: ₹3.80 Cr)
   - Routine advance renewal advice logged in Institution Portal notifications.

**Advisory Recommendation:** Trigger automated Form-R notice to the 3 critical overdue institutions to initiate replacement FDRs or risk EoA withholding.`,
        metadata: {
          badge: { text: '3 CRITICAL OVERDUE', variant: 'danger' },
          metrics: [
            { label: 'Critical Overdue', value: '3 Institutes' },
            { label: 'Expiring <30d', value: '5 Instruments' },
            { label: 'Pipeline 31-90d', value: '12 Instruments' },
            { label: 'Total Monitored', value: '₹54.20 Cr' },
          ],
          links: [
            { label: 'Inspect Maturity Pipeline Dashboard', href: '/overview' },
            { label: 'Open Alerts & Escalation Matrix', href: '/alerts' },
          ],
        },
      };
    }

    // 5. Shortfall Action & Penalties
    if (q.includes('shortfall') || q.includes('calculate') || q.includes('penalt') && q.includes('action')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Deposit Shortfall Computation & Escalation Protocol

#### Formula:
\`Shortfall = Mandatory Required Deposit - SUM(Active Valid Joint FDRs)\`

#### Calculation Parameters:
- **Excluded Instruments:** Instruments in \`EXPIRED\`, \`REJECTED\`, or \`RELEASED\` states.
- **Provisional Credit:** Instruments in \`UNDER_SCRUTINY\` are tagged as provisional and do not count towards full statutory clearance until bank verification confirmation is received.

#### Automated 4-Stage Regulatory Escalation Ladder:
1. **Stage 1 (Day 1 - Shortfall Detected):** Automated System Deficiency Memo issued to Institution Registrar. (14-day cure window).
2. **Stage 2 (Day 15 - Non-response):** Yellow Flag raised in Officer Queue; formal show-cause notification dispatched.
3. **Stage 3 (Day 30 - Overdue):** Escalated to Approving Authority; portal warns institution of impending intake freeze.
4. **Stage 4 (Day 45 - Statutory Default):** Red Flag triggered; Extension of Approval (EoA) withheld for upcoming academic session.`,
        metadata: {
          badge: { text: 'REGULATORY ESCALATION LADDER', variant: 'warning' },
          metrics: [
            { label: 'Grace Period', value: '14 Days' },
            { label: 'Show Cause', value: 'Day 15' },
            { label: 'Intake Freeze', value: 'Day 30' },
            { label: 'EoA Withheld', value: 'Day 45' },
          ],
          links: [{ label: 'Review Admin Alert Rules', href: '/admin/alert-rules' }],
        },
      };
    }

    // 6. Replacement FDR Submission
    if (q.includes('replacement') || q.includes('substitut') || q.includes('renew an expiring')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Protocol for Submitting a Replacement FDR (Rollover / Renewal)

When an existing security deposit reaches maturity, institutions must renew or replace the instrument to maintain uninterrupted regulatory compliance:

#### Step-by-Step Procedure in Saksham:
1. **Create Replacement Draft:** In your Institution Portal, navigate to **Instruments** → click **Submit New Instrument** → select **"Replacement / Rollover"**.
2. **Link Predecessor Certificate:** Enter the existing instrument ID (e.g., \`FDR-SBI-2022-044\`) to maintain unbroken audit chain-of-custody.
3. **Mandatory Documents Upload:**
   - Fresh Fixed Deposit Receipt with joint lien in favour of AICTE.
   - Bank Confirmation Letter with official branch dispatch reference.
   - Bank Undertaking guaranteeing tripartite rollover on maturity.
4. **Scrutiny & Retiring Old Record:** Once the Verifying Officer approves the replacement, the old instrument transitions cleanly to \`REPLACED\` without creating a gap in institutional compliance status.

**Compliance Advice:** Submit the replacement at least **30 days prior** to maturity to prevent automated shortfall alerts.`,
        metadata: {
          badge: { text: 'REPLACEMENT PROTOCOL', variant: 'info' },
          metrics: [
            { label: 'Submission Window', value: '30 Days Prior' },
            { label: 'Audit Linkage', value: 'Predecessor Linked' },
            { label: 'Lien Continuity', value: 'Zero-Gap' },
            { label: 'Review SLA', value: '5 Business Days' },
          ],
          links: [{ label: 'Submit Replacement Wizard', href: '/instruments/new' }],
        },
      };
    }

    // 7. Release Documents Checklist
    if (q.includes('checklist') || q.includes('document') && (q.includes('release') || q.includes('refund'))) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Statutory Document Checklist for Security Deposit Release / Refund

To initiate release of joint FDRs upon completion of the mandatory lock-in period (8–10 years) or formal institutional closure:

#### Mandatory Verification Dossier:
1. **Original Fixed Deposit Receipt:** High-resolution color scan with institutional endorsement surrender on the reverse.
2. **Bank No-Lien / Discharge Letter:** Official letter from the issuing bank confirming no third-party claims, court orders, or debt attachments exist against the deposit.
3. **Institutional Governing Body Resolution:** Formal resolution signed by the Trust/Society Chairperson authorizing deposit release and specifying designated bank account details.
4. **State Directorate of Technical Education (DTE) NOC:** Written clearance confirming zero student fee disputes or faculty salary arrears.
5. **AICTE Regional Office Inspection Report:** Clean compliance certificate with zero pending Ombudsman or grievance committee matters.

**Submission Route:** Navigate to **Releases** → **New Release Request** to upload this 5-document dossier.`,
        metadata: {
          badge: { text: '5-DOCUMENT DOSSIER', variant: 'info' },
          metrics: [
            { label: 'Original FDR', value: 'Mandatory' },
            { label: 'Bank No-Lien', value: 'Mandatory' },
            { label: 'DTE Clearance', value: 'Mandatory' },
            { label: 'Ombudsman NOC', value: 'Mandatory' },
          ],
          links: [{ label: 'Open Release Request Wizard', href: '/releases/new' }],
        },
      };
    }

    // 8. Bank Merger / IFSC Change
    if (q.includes('merger') || q.includes('ifsc') || q.includes('amalgamation')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Handling Bank Amalgamations, Branch Closures & IFSC Migrations

When public or private sector banks undergo mergers (e.g. Syndicate Bank into Canara Bank, Oriental Bank into PNB):

#### Regulatory Protocol in Saksham:
- **Validity of Existing Receipts:** The original deposit remains 100% legally binding under the successor bank's statutory liability.
- **Automated IFSC Mapping:** Saksham's bank registry service automatically updates legacy IFSC codes to their unified successor bank IFSCs via RBI cross-walk tables.
- **Institutional Requirement:**
  - Submit an **IFSC Migration Memo** signed by the new branch manager within **45 days** of branch re-branding.
  - Upload the revised bank letter under **Document Management**.
- **No Penalty:** Bank amalgamations do NOT trigger shortfall flags or compliance penalties, provided the deposit amount and joint lien terms remain unchanged.`,
        metadata: {
          badge: { text: 'RBI AMALGAMATION RULES', variant: 'success' },
          metrics: [
            { label: 'Auto IFSC Map', value: 'Supported' },
            { label: 'Notice Window', value: '45 Days' },
            { label: 'Lien Validity', value: 'Unbroken' },
            { label: 'Penalties', value: 'Nil' },
          ],
        },
      };
    }

    // 9. Mutual Funds, Shares, Corporate Bonds
    if (q.includes('mutual fund') || q.includes('share') || q.includes('bond') || q.includes('equity') || q.includes('crypto')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Admissibility of Non-FDR Financial Instruments (Mutual Funds, Bonds, Shares)

**Regulatory Verdict: STRICTLY INADMISSIBLE 🚫**

Under Section 4.3 of the AICTE Regulations Bureau Statutory Mandate:
- **Permitted Instruments:** ONLY Fixed Deposit Receipts (FDRs) from Scheduled Commercial Banks or Irrevocable Bank Guarantees (BGs) issued by RBI-licensed banks.
- **Prohibited Assets:** 
  - Mutual fund units (equity, hybrid, or debt)
  - Corporate debentures or bonds
  - Commercial paper or treasury bills
  - Equity shares, cryptocurrencies, or cooperative society deposits

#### Regulatory Rationale:
Security deposits must have **zero principal volatility** and allow instantaneous, sovereign-grade lien enforcement to protect student interests in the event of institutional closure or statutory default.`,
        metadata: {
          badge: { text: 'STRICTLY PROHIBITED', variant: 'danger' },
          metrics: [
            { label: 'Permitted', value: 'FDR & Bank Guarantees' },
            { label: 'Mutual Funds', value: 'Inadmissible' },
            { label: 'Corporate Bonds', value: 'Inadmissible' },
            { label: 'Principal Volatility', value: '0% Allowed' },
          ],
        },
      };
    }

    // 10. Premature Encashment Penalty
    if (q.includes('premature') || q.includes('liquidat') || q.includes('withdraw') && q.includes('penalt')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Legal Consequences of Unauthorized Premature FDR Encashment

Attempting to liquidate, pledge as loan collateral, or encash a joint security deposit without prior written release authorization from AICTE constitutes a serious statutory violation:

#### Immediate Regulatory Actions:
1. **Automated Bank Default Notification:** Banks under tripartite agreement automatically transmit a real-time breach event to Saksham via webhook/email.
2. **Immediate Show-Cause Notice:** Issued to the Trust President and Institution Principal with a strict **7-day response window**.
3. **Withdrawal of AICTE Approval (EoA):** Academic approval and student admission intake are immediately frozen.
4. **Legal Lien Recovery:** AICTE invokes the tripartite indemnity clause to recover the full principal amount plus compounded penal interest directly from the bank or institution accounts.
5. **National Blacklisting:** Sponsoring trustees are debarred from establishing any new educational institutions for a period of 5 years.`,
        metadata: {
          badge: { text: 'HIGH SEVERITY PENALTY', variant: 'danger' },
          metrics: [
            { label: 'Cure Window', value: '7 Days' },
            { label: 'Intake Status', value: 'Immediate Freeze' },
            { label: 'EoA Status', value: 'Withdrawn' },
            { label: 'Trustee Debarment', value: '5 Years' },
          ],
        },
      };
    }

    // 11. Track Uploaded FDR Verification
    if (q.includes('track') && (q.includes('stage') || q.includes('verification status') || q.includes('upload'))) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Tracking FDR Verification Stages in Saksham

Every newly submitted instrument moves through a transparent 5-stage scrutiny lifecycle:

#### Lifecycle States & Average Timelines:
1. **\`SUBMITTED\` (Day 0):** Document successfully encrypted (AES-256-GCM) and uploaded to MinIO. SHA-256 audit entry generated.
2. **\`UNDER_SCRUTINY\` (Days 1–3):** Assigned to Verifying Officer in the regional queue. OCR data extraction and side-by-side discrepancy check performed.
3. **\`BANK_CONFIRMATION_PENDING\` (Days 4–7):** Digital verification dispatch sent to the issuing bank branch nodal officer.
4. **\`APPROVED\` (Days 8–10):** Approving Authority digital signature applied; deposit count credited to institutional compliance quota.
5. **\`ACTIVE\`:** Instrument locked under official regulatory custody until scheduled maturity.

**How to Inspect:** Go to **Instruments** in your sidebar → click on any reference number to view the live timeline and scrutiny notes.`,
        metadata: {
          badge: { text: '5 LIFECYCLE STAGES', variant: 'info' },
          metrics: [
            { label: 'Stage 1', value: 'Submitted' },
            { label: 'Stage 2', value: 'Under Scrutiny' },
            { label: 'Stage 3', value: 'Bank Pending' },
            { label: 'Stage 4', value: 'Approved' },
          ],
          links: [{ label: 'Inspect My Instruments', href: '/instruments' }],
        },
      };
    }

    // 12. Govt vs Private College Norms
    if (q.includes('govt') || q.includes('government') || q.includes('private') || q.includes('aided')) {
      return {
        id,
        sender: 'assistant',
        mode: 'compliance',
        timestamp,
        text: `### Deposit Norms Comparison: Government / Aided vs Private Self-Financing Institutions

The AICTE Approval Process Handbook distinguishes between state-funded institutions and self-financing private colleges:

#### 1. 100% Government & State Universities (e.g. DTU, IITs, NITs):
- **Exemption / Concessions:** Eligible for **statutory fee waiver** or symbolic joint deposit guarantees backed by State Government Consolidated Funds.
- **Tenure:** Flexible lock-in; sovereign guarantee accepted in lieu of physical bank FDR.

#### 2. Government-Aided Institutions:
- **Concessional FDR Quantum:** 50% of the standard private college deposit schedule.
- **Endorsement:** Joint lien required with State Directorate of Technical Education and AICTE.

#### 3. Private / Self-Financing Un-Aided Institutions:
- **Full Deposit Schedule:** ₹35,00,000 to ₹50,00,000 per division intake.
- **No Concessions:** 100% bank-backed FDR with irrevocable tripartite auto-renewal is strictly mandatory.`,
        metadata: {
          badge: { text: 'POLICY COMPARISON', variant: 'info' },
          metrics: [
            { label: 'Govt Institutes', value: 'Sovereign Guarantee' },
            { label: 'Govt Aided', value: '50% Concession' },
            { label: 'Private Colleges', value: '100% Deposit Mandatory' },
            { label: 'Lock-in Period', value: '8 - 10 Years' },
          ],
        },
      };
    }

    // Generic Compliance Fallback
    return {
      id,
      sender: 'assistant',
      mode: 'compliance',
      timestamp,
      text: `### Institutional Compliance Intelligence Query: "${query}"

Based on AICTE Approval Process Handbook (APH) regulations and Saksham repository telemetry:

- **Institutional Oversight:** All technical institutions must sustain active, tripartite joint FDRs with AICTE.
- **Compliance Health Check:** Instruments undergo continuous automated maturity tracking (at 90, 60, 30, and 7-day intervals).
- **Statutory Enforcement:** Shortfalls, unendorsed receipts, or unverified deposits automatically trigger progressive warning notices.

**Suggested Queries:**
- *"What is DTU's current deposit compliance status?"*
- *"Is COEP eligible for deposit release?"*
- *"How does an institution submit a replacement FDR for an expiring deposit?"*
- *"What documents are required to apply for security deposit release or refund?"*`,
      metadata: {
        badge: { text: 'COMPLIANCE ADVISORY', variant: 'info' },
      },
    };
  }

  // -------------------------------------------------------------
  // MODE: EXPLAINABLE AI ASSISTANCE (Officers & Approvers)
  // -------------------------------------------------------------
  if (mode === 'explainable') {
    // 1. Trust Score 72 Breakdown
    if (q.includes('72') || q.includes('fdr-sbi-2025-001') || q.includes('trust score')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Explainable AI Breakdown: Trust Score 72/100

**Instrument Reference:** \`FDR-SBI-2025-001\` | **Bank:** State Bank of India  
**Declared Amount:** ₹35,00,000 | **Evaluation Model:** Champion Model v2.4 (Explainable Logistic Ensembles)

#### Mathematical Factor Weight Attribution:
The Trust Score represents the normalized weighted summation across 10 deterministic risk parameters:

1. **Bank Verification Status (Weight: 20%)** → **Score: 18/20**  
   *Positive:* Official confirmation letter issued by SBI Parliament Street Branch nodal officer.
2. **Issuing Bank Category (Weight: 15%)** → **Score: 15/15**  
   *Positive:* State Bank of India is a Tier-1 Public Sector Scheduled Commercial Bank.
3. **OCR Text & Value Fidelity (Weight: 15%)** → **Score: 12/15**  
   *Observation:* High OCR match on amount and date, but slight font variance detected on account number string.
4. **Date & Validity Invariants (Weight: 10%)** → **Score: 10/10**  
   *Positive:* Issue date (2025-01-15) precedes maturity date (2028-01-15); exactly matches 3-year term.
5. **Joint Lien AICTE Endorsement (Weight: 10%)** → **Score: 4/10** ⚠️  
   *Deduction Reason:* AI detected lien text present, but the word "Member Secretary" is slightly faded and requires human officer verification.
6. **Stamp & Signature Confidence (Weight: 10%)** → **Score: 6/10** ⚠️  
   *Deduction Reason:* Branch manager circular seal has 68% clarity (threshold: 75%).
7. **Institution Track Record (Weight: 5%)** → **Score: 5/5**  
   *Positive:* DTU has 0 historical compliance defaults over 15+ years.
8. **Cross-Document Consistency (Weight: 5%)** → **Score: 2/5** ⚠️  
   *Observation:* Bank confirmation date was issued 14 days after FDR certificate date.
9. **Amount Matching Mandate (Weight: 5%)** → **Score: 5/5**  
   *Positive:* Matches approved intake quota requirement exactly.
10. **Branch Geolocation & IFSC (Weight: 5%)** → **Score: 5/5**  
    *Positive:* \`SBIN0000691\` verified against RBI master database.

**Net Computed Trust Score:** **72 / 100** (\`NEEDS_REVIEW\` Band).  
**Human-in-the-Loop Verdict:** Officer scrutiny required specifically on Joint Lien endorsement stamp. System recommends officer request a high-resolution rescan or branch verification stamp confirmation.`,
        metadata: {
          badge: { text: 'NEEDS REVIEW (Score: 72)', variant: 'warning' },
          metrics: [
            { label: 'Overall Trust Score', value: '72 / 100' },
            { label: 'Risk Band', value: 'Needs Review' },
            { label: 'Model Version', value: 'v2.4 (Champion)' },
            { label: 'Factors Evaluated', value: '10 Factors' },
          ],
          factorBreakdown: [
            { factor: 'Bank Verification Status', weight: '20%', score: '18/20', contribution: '+18.0%', status: 'positive' },
            { factor: 'Issuing Bank Category', weight: '15%', score: '15/15', contribution: '+15.0%', status: 'positive' },
            { factor: 'OCR Text & Value Fidelity', weight: '15%', score: '12/15', contribution: '+12.0%', status: 'positive' },
            { factor: 'Date & Validity Invariants', weight: '10%', score: '10/10', contribution: '+10.0%', status: 'positive' },
            { factor: 'Joint Lien AICTE Endorsement', weight: '10%', score: '4/10', contribution: '+4.0%', status: 'warning' },
            { factor: 'Stamp & Signature Clarity', weight: '10%', score: '6/10', contribution: '+6.0%', status: 'warning' },
            { factor: 'Institution Track Record', weight: '5%', score: '5/5', contribution: '+5.0%', status: 'positive' },
            { factor: 'Cross-Document Consistency', weight: '5%', score: '2/5', contribution: '+2.0%', status: 'warning' },
            { factor: 'Amount Matching Mandate', weight: '5%', score: '5/5', contribution: '+5.0%', status: 'positive' },
            { factor: 'Branch Geolocation & IFSC', weight: '5%', score: '5/5', contribution: '+5.0%', status: 'positive' },
          ],
          links: [
            { label: 'Inspect Weight Allocations in Admin AI Console', href: '/admin/ai/weights' },
            { label: 'View Instrument in Scrutiny Queue', href: '/officer/queue' },
          ],
        },
      };
    }

    // 2. Turnaround Prediction
    if (q.includes('turnaround') || q.includes('prediction') || q.includes('4.2') || q.includes('days')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Explainable Turnaround Prediction Engine

Saksham forecasts expected turnaround times using a transparent Gradient Boosted Regression model calibrated against historical AICTE officer verification cycles.

#### Prediction Breakdown for Current Under Scrutiny Queue:
- **Point Estimate:** **4.2 Business Days**
- **90% Confidence Interval (CI):** **[3.1 – 5.8 Business Days]**
- **Deadline Risk Flag:** **NO RISK** (SLA standard is 10 business days).

#### Key Predictive Feature Contributions:
1. **Officer Queue Depth (+1.8 days):** Active scrutiny queue currently contains 14 pending instruments across North-West region.
2. **Issuing Bank Verification SLA (+1.4 days):** Historical API/email response latency for State Bank of India averages 36 hours.
3. **Document Quality Index (-0.8 days):** Clean 300 DPI PDF scan with clear printed typography speeds up manual reading.
4. **Institution Historical Cleanliness (-0.5 days):** Zero prior rejections from this university.
5. **Day-of-Week Effect (+0.3 days):** Submitted on Thursday, introducing weekend calendar buffer.

**Model Transparency:** All estimates report point estimate alongside 90% confidence bands. If the upper CI bound exceeds statutory SLA (10 days), an automated "At Risk" warning chip is displayed to supervisors.`,
        metadata: {
          badge: { text: 'ESTIMATE: 4.2 DAYS [3.1 - 5.8]', variant: 'info' },
          metrics: [
            { label: 'Point Estimate', value: '4.2 Days' },
            { label: '90% Conf. Interval', value: '[3.1 – 5.8 d]' },
            { label: 'SLA Limit', value: '10.0 Days' },
            { label: 'Risk Status', value: 'Safe (On Track)' },
          ],
          links: [{ label: 'Inspect Model Registry Metrics (MAE, R²)', href: '/admin/ai/models' }],
        },
      };
    }

    // 3. OCR Mismatch Root Cause
    if (q.includes('ocr') || q.includes('mismatch') || q.includes('discrepancy') && q.includes('axis')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Root Cause Analysis: OCR Document Discrepancy Flag

**Discrepancy Code:** \`OCR_MISMATCH\` | **Severity:** High  
**Affected Instrument:** Sample Instrument (Axis Bank Deposit Certificate)

#### Root Cause Explanation:
During the document ingestion pipeline, Saksham's OCR engine extracts structured key-value pairs and runs automated cross-verification against the institution's self-declared portal submission.

#### Field-Level Discrepancy Audit:
- **Declared Principal Amount:** \`₹50,00,000\` (Fifty Lakhs Rupees)
- **Extracted Text from Certificate:** \`₹5,00,000\` (Five Lakhs Rupees)
- **Extracted Word String:** *"Rupees Five Lakhs Only"*
- **Confidence Metric:** 99.1% optical character recognition certainty.

#### Why the AI Flagged This:
The mathematical difference is **₹45,00,000 (90% discrepancy)**. This usually indicates a clerical typographical error (missing zero) by the institution operator during portal data entry, or upload of an incorrect intermediate receipt.

**Governance Safeguard:** Rather than rejecting the application autonomously, the system flags the field in red, disables one-click approval, and generates a pre-formatted query memo for the Verifying Officer to send back to the institution.`,
        metadata: {
          badge: { text: 'OCR_MISMATCH DETECTED', variant: 'danger' },
          metrics: [
            { label: 'Declared Amount', value: '₹50,00,000' },
            { label: 'Extracted Amount', value: '₹5,00,000' },
            { label: 'Discrepancy Gap', value: '₹45,00,000' },
            { label: 'Extraction Confidence', value: '99.1%' },
          ],
          links: [{ label: 'Inspect Scrutiny Console', href: '/officer/queue' }],
        },
      };
    }

    // 4. Weights Calibration
    if (q.includes('weight') || q.includes('calibration') || q.includes('champion') || q.includes('10-factor')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### 10-Factor Trust Score Weights & Calibration Governance

In accordance with Phase 7 Explainability standards, Trust Score weights are stored in the database, version-controlled, and configurable by authorized Admins:

#### Active Champion Configuration (Version 2.4):
- **Bank Verification Direct Confirmation:** **20%**
- **Issuing Bank Reliability Category:** **15%**
- **OCR Text & Numeric Cross-Match:** **15%**
- **Date Invariant Consistency:** **10%**
- **Joint Lien AICTE Clause Clarity:** **10%**
- **Stamp & Authorized Signatory Confidence:** **10%**
- **Institution Compliance History:** **5%**
- **Cross-Document Uniformity:** **5%**
- **Intake Mandate Concordance:** **5%**
- **Branch IFSC & Geolocation Verification:** **5%**
- **Sum Total:** **Exactly 100.0%**

#### Invariant Enforcement:
Any weight adjustment in the Admin AI Console must pass strict client and server validation requiring the sum of all 10 factors to equal exactly 100%. All re-calibrations create an immutable audit record containing the admin's ID, timestamp, and mathematical justification.`,
        metadata: {
          badge: { text: 'WEIGHTS: 100% SUM VALIDATED', variant: 'success' },
          metrics: [
            { label: 'Active Version', value: 'v2.4' },
            { label: 'Total Factors', value: '10 Parameters' },
            { label: 'Sum Total', value: '100.0%' },
            { label: 'Admin Governed', value: 'Yes' },
          ],
          links: [{ label: 'Open Admin Weights Console', href: '/admin/ai/weights' }],
        },
      };
    }

    // 5. Five Invariants
    if (q.includes('invariant') || q.includes('ethical') || q.includes('governance') || q.includes('5 ethical')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### The 5 Ethical AI Governance Invariants in Saksham

To guarantee that artificial intelligence strictly serves as an accountable advisor rather than an autonomous decision maker, the system enforces 5 non-negotiable architectural invariants:

1. **Advisory Assistance Only ("Officers Decide"):**
   AI models cannot mutate instrument status, approve discharges, or reject institutions. Final legal authority remains exclusively with designated human AICTE officers.
2. **Data Honesty & Synthetic Disclaimers:**
   Every synthetic metric or demo figure is stamped with a visible \`Synthetic Data\` badge and mathematical explanation. No fabricated certainty.
3. **Mathematical Explainability:**
   No bare scores or black-box predictions. Every Trust Score exposes its 10-factor component breakdown; every turnaround prediction provides 90% confidence bounds.
4. **Graceful Degradation:**
   If AI services or external OCR APIs become unavailable, the entire portal remains 100% operational via traditional manual verification workflows.
5. **Strict Privacy Boundary:**
   Zero institutional PII, bank account beneficiary keys, or unredacted confidential documents leave the secure on-premise perimeter.`,
        metadata: {
          badge: { text: '5 ETHICAL INVARIANTS ENFORCED', variant: 'success' },
          metrics: [
            { label: 'Human-in-the-Loop', value: 'Mandatory' },
            { label: 'Autonomous Approvals', value: 'Blocked (0%)' },
            { label: 'Audit Trail', value: 'SHA-256 Chained' },
            { label: 'Fallback Mode', value: 'Active' },
          ],
        },
      };
    }

    // 6. Suspect Document Type Warning
    if (q.includes('suspect') || q.includes('doc_type_suspect') || q.includes('document type')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Anomaly Audit: SUSPECT_DOC_TYPE Classification Warning

**Discrepancy Code:** \`DOC_TYPE_SUSPECT\` | **Triggered Model:** Visual Layout Classifier v1.8

#### Why Was This Flagged?
When a certificate file is uploaded under document type \`FDR_CERTIFICATE\`, the classifier analyzes layout geometry, text density, and security borders:
- **Expected Document:** Official stamped Fixed Deposit Receipt or Term Deposit Certificate with security border, revenue stamp, certificate serial, and dual bank signatures.
- **Detected Document:** Computer-generated Account Statement or Deposit Advice Letter.
- **Classification Confidence:** 88.4% probability of incorrect document categorization.

#### Officer Recommendation:
1. Open the side-by-side scrutiny viewer.
2. Verify if the institution accidentally uploaded an account statement instead of the physical stamped FDR.
3. If confirmed incorrect, click **"Request Rescan / Reject Upload"** to notify the institution without terminating the entire application.`,
        metadata: {
          badge: { text: 'SUSPECT_DOC_TYPE (88.4%)', variant: 'warning' },
          metrics: [
            { label: 'Expected Layout', value: 'FDR Certificate' },
            { label: 'Detected Layout', value: 'Account Statement' },
            { label: 'Visual Confidence', value: '88.4%' },
            { label: 'Action Recommended', value: 'Request Rescan' },
          ],
          links: [{ label: 'Inspect in Scrutiny View', href: '/officer/queue' }],
        },
      };
    }

    // 7. IFSC & Geolocation Verification
    if (q.includes('ifsc') || q.includes('geolocation') || q.includes('radius') || q.includes('branch distance')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Explainable Model: Branch IFSC & Geolocation Verification Logic

**Factor Weight:** 5% of Trust Score | **Model Layer:** RBI Master Directory & Spatial Proximity

#### Algorithmic Verification Steps:
1. **IFSC Checksum & Existence:**
   - Queries the official RBI Master Branch Directory for code format (e.g., \`SBIN0000691\`).
   - Confirms branch operational status (Active vs Merged / Closed).
2. **Spatial Distance Calculation (Haversine Formula):**
   - Extracts GPS coordinates of the issuing bank branch.
   - Computes radial distance between the declared branch and the institution campus.
3. **Anomaly Heuristic:**
   - **Distance < 25 km:** Normal local institutional banker (+5.0% contribution).
   - **Distance 25–100 km:** Acceptable regional zonal hub (+4.0% contribution).
   - **Distance > 500 km (Unusual):** Flagged for scrutiny to verify why a remote out-of-state branch issued the certificate without corporate justification (+1.5% contribution).`,
        metadata: {
          badge: { text: 'IFSC & SPATIAL VERIFIED', variant: 'success' },
          metrics: [
            { label: 'IFSC Registry', value: 'RBI Master Active' },
            { label: 'Distance Band', value: 'Local (<25km)' },
            { label: 'Weight Allocation', value: '5.0%' },
            { label: 'Risk Delta', value: '0% (Clean)' },
          ],
        },
      };
    }

    // 8. Fast-Track Criteria (Score > 85)
    if (q.includes('fast-track') || q.includes('> 85') || q.includes('85') || q.includes('score > 85')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Fast-Track Scrutiny Eligibility Criteria (Trust Score > 85)

Instruments that achieve an aggregated Trust Score exceeding **85 / 100** qualify for the expedited "Fast-Track" verification workflow, reducing officer review latency from 4.2 days to <24 hours:

#### Mandatory Composite Triggers:
1. **Tier-1 Scheduled Bank:** Public Sector Bank (SBI, PNB, Canara, BoB) or Top-Tier Private Bank (HDFC, ICICI, Axis).
2. **Direct Bank Confirmation Received:** Official bank nodal officer response letter uploaded with matching dispatch stamp (+20%).
3. **Zero OCR Discrepancies:** 100% concordance between institution-declared amount, issue date, tenure, and extracted text.
4. **Clean Joint Lien AICTE Clause:** Crystal clear circular seal and unambiguous "in favour of Regional Officer, AICTE" phrasing.
5. **Flawless Institution Track Record:** Zero regulatory non-compliance flags over the past 5 academic years.

**Human-in-the-Loop Safeguard:** Even on Fast-Track cases, a human Verifying Officer must execute a final 1-click confirmation before the file moves to the Approving Authority. Autonomous approvals remain strictly prohibited.`,
        metadata: {
          badge: { text: 'FAST-TRACK ELIGIBLE (>85)', variant: 'success' },
          metrics: [
            { label: 'Score Threshold', value: '> 85 / 100' },
            { label: 'Bank Direct Auth', value: 'Verified' },
            { label: 'OCR Mismatch', value: '0' },
            { label: 'Review SLA', value: '<24 Hours' },
          ],
        },
      };
    }

    // 9. Active Learning & Feedback Retraining
    if (q.includes('active learning') || q.includes('feedback') || q.includes('retrain') || q.includes('telemetry')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Active Learning & Feedback Retraining Architecture

Under Phase 7C, officer interactions continuously improve AI accuracy through transparent telemetry:

#### Feedback Ingestion Flow:
1. **Correction Capture:** When an officer clicks **"Correct Flag / False Alarm"** or edits an OCR-extracted field, an atomic payload is posted to \`POST /api/v1/ai/feedback\`.
2. **Telemetry Payload:** Contains \`instrument_id\`, \`model_version\`, \`feature_tag\` (e.g. \`OCR_AMOUNT\`), \`officer_action\`, and SHA-256 hash.
3. **No PII Transmission:** Institutional names and personal IDs are stripped; only document layout vectors and OCR character confidence tensors are preserved.
4. **Model Retraining Cycle:**
   - Quarterly retrained models are evaluated on holdout validation datasets (reporting MAE, RMSE, and F1-score).
   - If challenger model metrics exceed the current champion, Admins can promote the new model version via the **Model Registry Console** (\`/admin/ai/models\`).`,
        metadata: {
          badge: { text: 'ACTIVE LEARNING TELEMETRY', variant: 'info' },
          metrics: [
            { label: 'Endpoint', value: '/ai/feedback' },
            { label: 'PII Scrubbing', value: 'Strict Allow-List' },
            { label: 'Cadence', value: 'Quarterly Cycle' },
            { label: 'Promotion', value: 'Admin Governed' },
          ],
          links: [
            { label: 'View Feedback Stats Console', href: '/admin/ai/feedback' },
            { label: 'Inspect Model Registry', href: '/admin/ai/models' },
          ],
        },
      };
    }

    // 10. At-Risk Turnaround SLA Warning
    if (q.includes('at risk') || q.includes('sla warning') || q.includes('deadline')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Predictive Analytics: "At Risk" Turnaround SLA Warning Logic

Saksham continuously projects verification completion against statutory regulatory deadlines (10 business days):

#### Trigger Mechanism for "At Risk" Status:
An instrument is tagged with the red **"At Risk"** chip when the **Upper Bound of the 90% Confidence Interval exceeds 10 Business Days**:
- **Formula:** \`Point Estimate + (1.645 * Standard Error) > 10.0 Days\`

#### Root Drivers for Elevated Processing Latency:
1. **Bank Communication Lag (+3.5 days):** Cooperative or regional rural banks with manual postal branch verification.
2. **OCR Discrepancy Scrutiny Overhead (+2.8 days):** Mismatched amounts or suspect seals requiring formal clarification memos.
3. **Regional Queue Backlog (+2.2 days):** Queue volume exceeding 25 pending applications per officer.

**Supervisor Intervention:** Approvers and Admins can sort queues by the "At Risk" badge to reassign files or trigger expedited telephone escalation with branch managers.`,
        metadata: {
          badge: { text: 'AT RISK WARNING LOGIC', variant: 'danger' },
          metrics: [
            { label: 'SLA Ceiling', value: '10.0 Days' },
            { label: 'Confidence Band', value: '90% Upper Bound' },
            { label: 'Backlog Factor', value: 'Queue > 25 Cases' },
            { label: 'Escalation', value: 'Supervisor Alert' },
          ],
          links: [{ label: 'Inspect Officer Queue', href: '/officer/queue' }],
        },
      };
    }

    // 11. Approver Override & Audit
    if (q.includes('override') || q.includes('approve anyway') || q.includes('approver authority')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### Approver Override Authority & Immutable SHA-256 Audit Trail

**Can an Approver approve an instrument despite an AI Discrepancy Flag? YES.**

In strict adherence to the *Officers Decide* invariant:
- AI anomaly flags (e.g. \`OCR_MISMATCH\`, \`DOC_TYPE_SUSPECT\`, Low Trust Score) are **informational warnings**, NOT legal vetoes.
- The Approving Authority retains full legal authority to grant approval if satisfied with external evidence.

#### Mandatory Override Protocol:
1. **Written Justification:** Approver must input a mandatory rationale note (minimum 25 characters, e.g. *"Branch manager confirmed ₹50L deposit via certified bank dispatch email"*).
2. **Digital Signature:** Applied using official credentials.
3. **SHA-256 Hash Chained Audit Entry:** The system generates an append-only audit event:
   - \`action: OVERRIDE_AI_WARNING\`
   - \`approver_id: usr-approver-001\`
   - \`ai_flags_overridden: [OCR_MISMATCH]\`
   - \`timestamp & sha256_hash\`
   - Visible permanently on the instrument's timeline and in the Admin Audit Log.`,
        metadata: {
          badge: { text: 'IMMUTABLE AUDIT LOGGED', variant: 'warning' },
          metrics: [
            { label: 'Officer Authority', value: 'Supreme' },
            { label: 'Justification Note', value: 'Mandatory' },
            { label: 'Audit Chain', value: 'SHA-256' },
            { label: 'Autonomous Veto', value: 'None' },
          ],
          links: [{ label: 'Inspect Admin Audit Trail', href: '/admin/audit-log' }],
        },
      };
    }

    // 12. Cross-Document 3-Way Consistency
    if (q.includes('3-way') || q.includes('three-way') || q.includes('cross-document') || q.includes('cross document')) {
      return {
        id,
        sender: 'assistant',
        mode: 'explainable',
        timestamp,
        text: `### 3-Way Cross-Document Consistency Engine

The 3-Way Consistency scoring factor (Weight: 5%) performs automated triangular reconciliation across three distinct system artifacts:

#### Triangular Reconciliation Model:
1. **Artifact A:** Institution-Declared Portal Submission Form
2. **Artifact B:** OCR Extracted Data from Uploaded FDR Certificate Image
3. **Artifact C:** Bank Branch Verification Letter / Dispatch Acknowledgement

#### Key Fields Reconciled:
- **Exact Beneficiary Phrasing:** *"Institution & Regional Officer, AICTE"*
- **FDR Account Reference Number:** Character-level alignment (Levenshtein distance < 1).
- **Principal Quantum:** Numerical currency equality (₹35,00,000 == ₹35,00,000).
- **Issuing & Maturity Dates:** Date invariant verification (Maturity > Issue + 365*3).
- **Branch Seal & IFSC Alignment:** Matches declared bank location.

**Score Output:** Full match awards +5.0% contribution to Trust Score. Discrepancies generate line-item delta tags for officer review.`,
        metadata: {
          badge: { text: '3-WAY RECONCILIATION', variant: 'success' },
          metrics: [
            { label: 'Artifact A', value: 'Portal Form' },
            { label: 'Artifact B', value: 'FDR Certificate' },
            { label: 'Artifact C', value: 'Bank Letter' },
            { label: 'Score Contribution', value: '+5.0%' },
          ],
        },
      };
    }

    // Generic Explainable Fallback
    return {
      id,
      sender: 'assistant',
      mode: 'explainable',
      timestamp,
      text: `### Explainable AI Assistance Query: "${query}"

Saksham's Explainable AI layer provides mathematical decomposition and transparency for officers and approvers:

- **10-Factor Mathematical Decomposition:** Deconstructs 0-100 Trust Scores into verifiable parameters.
- **Turnaround Forecasting:** Combines officer queue volume, bank response SLA, and OCR quality to calculate expected days to completion with 90% confidence bands.
- **OCR Anomaly Flagging:** Explains character-level discrepancies between declared values and document image extractions.

**Suggested Queries for Officers:**
- *"Why does FDR-SBI-2025-001 have an AI Trust Score of 72?"*
- *"Why did the AI trigger a SUSPECT_DOC_TYPE flag on the uploaded receipt?"*
- *"How does the AI verify issuing branch IFSC codes and geographic radius?"*
- *"What specific parameters qualify an instrument for Fast-Track Verification (Score > 85)?"*`,
      metadata: {
        badge: { text: 'EXPLAINABLE AI ADVISORY', variant: 'info' },
      },
    };
  }

  return {
    id,
    sender: 'assistant',
    mode,
    timestamp,
    text: `I'm here to assist with **Institutional Compliance Intelligence** and **Explainable AI Assistance**. Please select a preset topic or ask any specific question.`,
  };
}
