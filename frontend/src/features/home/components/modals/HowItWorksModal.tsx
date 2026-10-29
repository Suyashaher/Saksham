import React from 'react';
import { BaseModal } from './BaseModal';
import {
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertOctagon,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    step: '1',
    name: 'Submission',
    badge: 'SUBMITTED',
    icon: FileText,
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    desc: 'Institution registers FDR or Bank Guarantee details and uploads original scanned certificates.',
  },
  {
    step: '2',
    name: 'Scrutiny & OCR',
    badge: 'UNDER_SCRUTINY',
    icon: Clock,
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
    desc: 'AICTE scrutiny officers validate document completeness, check OCR extracts, and detect mismatches.',
  },
  {
    step: '3',
    name: 'Bank Verification',
    badge: 'BANK_VERIFIED',
    icon: ShieldCheck,
    badgeBg: 'bg-teal-50 text-teal-800 border-teal-300',
    desc: 'Issuing bank branch confirms irrevocable lien marking in favor of Member Secretary, AICTE.',
  },
  {
    step: '4',
    name: 'Active Encumbrance',
    badge: 'ACTIVE',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    desc: 'Deposit remains locked and active throughout institutional statutory tenure (e.g., 8-year lock-in).',
  },
  {
    step: '5',
    name: 'Proactive Reminders',
    badge: 'EXPIRING',
    icon: AlertCircle,
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
    desc: 'Automated 90, 60, and 30-day notifications alert both institution and regional bureau before maturity.',
  },
  {
    step: '6',
    name: 'Maturity & Renewal',
    badge: 'MATURED / RENEWED',
    icon: AlertOctagon,
    badgeBg: 'bg-orange-50 text-orange-900 border-orange-300',
    desc: 'Scheduled maturity triggers renewal review or replacement certificate chain-of-custody logging.',
  },
  {
    step: '7',
    name: 'Release Clearance',
    badge: 'RELEASE_REQUESTED',
    icon: RefreshCw,
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-300',
    desc: 'Conditional release engine validates student batch completion and regulatory non-encumbrance.',
  },
  {
    step: '8',
    name: 'Statutory Discharge',
    badge: 'RELEASED',
    icon: Lock,
    badgeBg: 'bg-slate-900 text-white border-slate-800',
    desc: 'Approving authority issues digital discharge sanction and branch releases institutional lien.',
  },
];

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="How Saksham Works: End-to-End Lifecycle"
      subtitle="The 8 Statutory Stages from Initial Submission to Formal Lien Discharge"
      maxWidth="3xl"
    >
      <div className="space-y-3">
        <div className="p-3 bg-primary-50/70 rounded-xl border border-primary-200 text-xs text-primary-950">
          <p className="font-bold">Automated Tripartite Architecture:</p>
          <p className="mt-0.5">
            Every instrument transitions through transparent, auditable stages ensuring that institutional deposits remain secure, verified by banks, and discharged without administrative delay.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {step.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold text-slate-900">{step.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${step.badgeBg}`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      <span>{step.badge}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseModal>
  );
};
