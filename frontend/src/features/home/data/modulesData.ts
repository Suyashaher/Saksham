export interface CoreModule {
  id: string;
  number: string;
  title: string;
  description: string;
  iconName: string;
}

export const CORE_MODULES: CoreModule[] = [
  {
    id: 'central-repository',
    number: '01',
    title: 'Central Repository',
    description: 'Unified national registry consolidating all technical institute security deposits and bank guarantees in one secure ledger.',
    iconName: 'Database',
  },
  {
    id: 'document-management',
    number: '02',
    title: 'Document Management',
    description: 'Tamper-evident document repository with multi-format support, automated OCR extraction, and virus scanning.',
    iconName: 'FolderArchive',
  },
  {
    id: 'verification-discrepancy',
    number: '03',
    title: 'Verification & Discrepancy Detection',
    description: 'Side-by-side scrutiny console comparing declared instrument attributes against bank verification letters to catch mismatches early.',
    iconName: 'FileCheck',
  },
  {
    id: 'validity-maturity-tracking',
    number: '04',
    title: 'Validity & Maturity Tracking',
    description: 'Real-time countdown engine categorizing instruments into clear operational states (>90 days, 31-90 days, <30 days, overdue).',
    iconName: 'ClockAlert',
  },
  {
    id: 'renewal-replacement',
    number: '05',
    title: 'Renewal & Replacement Monitoring',
    description: 'Continuous chain-of-custody tracking linking renewed certificates and replacements to preserve institutional compliance history.',
    iconName: 'RefreshCw',
  },
  {
    id: 'release-refund-workflow',
    number: '06',
    title: 'Release & Refund Workflow',
    description: 'Rule-based clearance engine verifying statutory conditions before authorizing discharge and releasing institutional liens.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'alerts-escalation',
    number: '07',
    title: 'Alerts & Escalation Matrix',
    description: 'Configurable multi-channel notifications (in-app, email, SMS) with automatic regulatory escalation when actions are overdue.',
    iconName: 'BellRing',
  },
  {
    id: 'dashboard-reports',
    number: '08',
    title: 'Dashboards, Reports & NL Search',
    description: 'Role-specific executive overviews, maturity forecasting charts, and conversational Natural-Language Search (e.g., "show SBI deposits in Karnataka expiring in 60 days").',
    iconName: 'BarChart3',
  },
  {
    id: 'audit-trail-access-control',
    number: '09',
    title: 'Audit Trail & Access Control',
    description: 'Immutable chronological event ledger with SHA-256 hash chaining and strict role-based access control (RBAC).',
    iconName: 'History',
  },
  {
    id: 'integration-data-security',
    number: '10',
    title: 'Integration & Data Security',
    description: 'Enterprise-grade 256-bit AES encryption, OTP multi-factor authentication, and secure bank API connectors.',
    iconName: 'Lock',
  },
];
