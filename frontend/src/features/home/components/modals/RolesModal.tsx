import React from 'react';
import { BaseModal } from './BaseModal';
import { Building2, ShieldCheck, CheckSquare, ShieldAlert, Landmark } from 'lucide-react';

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES = [
  {
    title: 'Technical Institutions',
    subtitle: 'Colleges, Universities & Autonomous Institutes',
    icon: Building2,
    color: 'text-primary bg-primary-50 border-primary-200',
    bullets: [
      'Submit new joint security deposit FDRs and Bank Guarantees.',
      'Upload bank confirmation and tripartite lien letters.',
      'Track real-time scrutiny status and respond to discrepancies.',
      'Request timely refund release upon academic batch completion.',
    ],
  },
  {
    title: 'Verifying Officers',
    subtitle: 'AICTE Regional Bureau Scrutiny Officers',
    icon: ShieldCheck,
    color: 'text-teal-700 bg-teal-50 border-teal-200',
    bullets: [
      'Evaluate uploaded certificates using side-by-side OCR tools.',
      'Validate bank confirmation letters and lien authenticity.',
      'Flag discrepancy notices with specific remediation notes.',
      'Forward verified dossiers to Approving Authority.',
    ],
  },
  {
    title: 'Approving Authorities',
    subtitle: 'Council Leadership & Regional Directors',
    icon: CheckSquare,
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    bullets: [
      'Review verified scrutiny dossiers and statutory recommendations.',
      'Sanction final acceptance and official AICTE encumbrance.',
      'Monitor statutory maturity countdowns and aging profiles.',
      'Authorize formal discharge orders and digital release certificates.',
    ],
  },
  {
    title: 'System Administrators',
    subtitle: 'IT Governance & Regulatory Operations',
    icon: ShieldAlert,
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    bullets: [
      'Configure notification thresholds and statutory alert rules.',
      'Manage user directories, roles, and institutional affiliations.',
      'Inspect immutable cryptographic audit trails and event logs.',
      'Oversee AI health, trust scoring weights, and model metrics.',
    ],
  },
];

export const RolesModal: React.FC<RolesModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="User Roles & Governance Structure"
      subtitle="Role-Based Access Control (RBAC) and Operational Privileges"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg border ${r.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{r.title}</h3>
                    <p className="text-[10px] text-slate-500">{r.subtitle}</p>
                  </div>
                </div>

                <ul className="space-y-1 text-xs text-slate-700 pt-1">
                  {r.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Bank external verifier note */}
        <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center gap-3 text-xs text-teal-950">
          <Landmark className="w-5 h-5 text-teal-700 shrink-0" />
          <div>
            <span className="font-bold">External Banking Verifier: </span>
            <span>
              Commercial bank branches act as independent external verifiers. They issue verification letters and acknowledge lien markings without holding portal operator credentials.
            </span>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
