import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Lock, KeyRound, History, FileCheck2, Server } from 'lucide-react';

interface SecurityFeature {
  title: string;
  implementation: string;
  description: string;
  icon: React.ElementType;
}

const SECURITY_PILLARS: SecurityFeature[] = [
  {
    title: 'Role-Based Access Control (RBAC)',
    implementation: 'JWT Session Tokens & Scope Verification',
    description:
      'Strict separation of privileges across Institutions, Verifying Officers, Approving Authorities, and Administrators enforced at both the API route and UI component levels.',
    icon: ShieldCheck,
  },
  {
    title: 'Multi-Factor OTP Authentication',
    implementation: 'Time-Limited 6-Digit OTP Protocol',
    description:
      'All portal sign-ins require second-factor verification, protecting institutional credentials from credential stuffing and unauthorized access.',
    icon: KeyRound,
  },
  {
    title: 'Tamper-Evident Audit Trail',
    implementation: 'SHA-256 Cryptographic Hash Chaining',
    description:
      'Every submission, scrutiny remark, status transition, and approval is recorded in an immutable ledger with previous-hash verification to guarantee non-repudiation.',
    icon: History,
  },
  {
    title: '256-bit AES Document Encryption',
    implementation: 'End-to-End File Vault Encryption',
    description:
      'Uploaded financial certificates, FDR scans, and bank lien letters are encrypted at rest using military-grade 256-bit AES standards.',
    icon: Lock,
  },
  {
    title: 'Statutory Release Safeguards',
    implementation: 'Multi-Tier Pre-Condition Validation',
    description:
      'Security deposits cannot be released without passing statutory checklists: no pending student grievances, valid tenure completion, and formal approving sanction.',
    icon: FileCheck2,
  },
  {
    title: 'Zero External Script Dependencies',
    implementation: 'Self-Hosted Strict CSP Architecture',
    description:
      'The portal loads zero external analytics, tracking pixels, or third-party fonts at runtime, maintaining a strict Content Security Policy (CSP).',
    icon: Server,
  },
];

export const SecurityTrustSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="security"
      aria-label="Security, Compliance and Trust Architecture"
      className="py-16 bg-white border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.security.section_badge', 'Integrity & Trust')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.security.section_title', 'Security, Compliance & Trust')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.security.section_subtitle',
              'Built strictly according to Indian e-Governance standards and data privacy mandates.'
            )}
          </p>
        </div>

        {/* 6 Security Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECURITY_PILLARS.map((pillar, idx) => {
            const IconComp = pillar.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-primary shadow-xs">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{pillar.title}</h3>
                    <p className="text-[11px] font-mono font-semibold text-primary">
                      {pillar.implementation}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-2">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Compliance Certification Note */}
        <div className="mt-8 p-4 rounded-xl bg-slate-100 text-center text-xs text-slate-600 border border-slate-200">
          <p className="font-semibold text-slate-800">
            Digital Personal Data Protection (DPDP) Act 2023 & IT Act 2000 Ready:
          </p>
          <p className="mt-0.5 text-slate-500">
            All data handling procedures adhere strictly to Government of India e-Governance interoperability frameworks and data minimization principles.
          </p>
        </div>
      </div>
    </section>
  );
};
