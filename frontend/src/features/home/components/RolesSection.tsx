import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ShieldCheck, CheckSquare, ShieldAlert, ArrowRight, Landmark } from 'lucide-react';

interface RoleCardData {
  id: string;
  roleTitle: string;
  subtitle: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  capabilities: string[];
}

const ROLES_LIST: RoleCardData[] = [
  {
    id: 'institution',
    roleTitle: 'Technical Institutions',
    subtitle: 'Colleges, Universities & Autonomous Institutes',
    icon: Building2,
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary',
    capabilities: [
      'Submit new security deposit FDRs and Bank Guarantees.',
      'Upload bank confirmation and tripartite lien letters.',
      'Track real-time scrutiny status and respond to discrepancies.',
      'Request timely refund release upon course completion.',
    ],
  },
  {
    id: 'officer',
    roleTitle: 'Verifying Officers',
    subtitle: 'AICTE Regional Bureau Scrutiny Officers',
    icon: ShieldCheck,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-700',
    capabilities: [
      'Evaluate uploaded certificates using side-by-side OCR tools.',
      'Validate bank confirmation letters and lien authenticity.',
      'Flag discrepancy notices with specific remediation notes.',
      'Forward verified portfolios to Approving Authority.',
    ],
  },
  {
    id: 'approver',
    roleTitle: 'Approving Authorities',
    subtitle: 'Council Leadership & Regional Directors',
    icon: CheckSquare,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-700',
    capabilities: [
      'Review verified scrutiny dossiers and statutory recommendations.',
      'Sanction final acceptance and official AICTE encumbrance.',
      'Monitor statutory maturity countdowns and aging profiles.',
      'Authorize formal discharge orders and digital release certificates.',
    ],
  },
  {
    id: 'admin',
    roleTitle: 'System Administrators',
    subtitle: 'IT Governance & Regulatory Operations',
    icon: ShieldAlert,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    capabilities: [
      'Configure notification thresholds and statutory alert rules.',
      'Manage user directories, roles, and institutional affiliations.',
      'Inspect immutable cryptographic audit trails and event logs.',
      'Oversee AI health, trust scoring weights, and model metrics.',
    ],
  },
];

export const RolesSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="roles"
      aria-label="Who Uses the Portal"
      className="py-16 bg-white border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.roles.section_badge', 'Access & Governance')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.roles.section_title', 'Who Uses the Portal')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.roles.section_subtitle',
              'Four dedicated user roles governed by strict Role-Based Access Control (RBAC), supported by external banking verifiers.'
            )}
          </p>
        </div>

        {/* 4 Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES_LIST.map((role) => {
            const IconComp = role.icon;
            return (
              <div
                key={role.id}
                className="flex flex-col justify-between p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl ${role.iconBg} ${role.iconColor} border border-slate-200 shadow-xs`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{role.roleTitle}</h3>
                  <p className="text-xs text-slate-500 font-medium mb-4">{role.subtitle}</p>

                  <ul className="space-y-2 text-xs text-slate-700 mb-6">
                    {role.capabilities.map((cap, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-between w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors shadow-xs"
                  >
                    <span>Sign in as {role.roleTitle.split(' ')[0]}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* External Banking Authority Note */}
        <div className="mt-8 p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="text-left text-xs text-teal-950">
              <p className="font-bold text-teal-900">External Verifier: Issuing Commercial Banks</p>
              <p className="text-teal-800 mt-0.5">
                Bank branches act as external verification authorities, providing independent lien confirmations and verification certificates without direct login dependencies.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-teal-800 bg-white px-3 py-1 rounded border border-teal-300 shrink-0">
            TRIPARTITE ARCHITECTURE
          </span>
        </div>
      </div>
    </section>
  );
};
