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

interface LifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STAGES = [
  {
    step: '01',
    name: 'Submitted',
    icon: FileText,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    description: 'Institution enters deposit attributes and uploads original scanned fixed deposit certificate.',
  },
  {
    step: '02',
    name: 'Under Scrutiny',
    icon: Clock,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300',
    description: 'AICTE regional scrutiny officer validates certificate completeness and verifies OCR extraction.',
  },
  {
    step: '03',
    name: 'Verified (or Discrepancy)',
    icon: ShieldCheck,
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-300',
    description: 'Issuing bank branch confirms lien; any mismatch triggers immediate discrepancy remediation notice.',
  },
  {
    step: '04',
    name: 'Active & Valid',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    description: 'Security deposit is legally encumbered in favor of Member Secretary, AICTE, and actively monitored.',
  },
  {
    step: '05',
    name: 'Expiring Soon',
    icon: AlertCircle,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    description: 'Automated 90, 60, and 30-day proactive reminder notifications are dispatched to the institution.',
  },
  {
    step: '06',
    name: 'Matured / Overdue',
    icon: AlertOctagon,
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-900',
    badgeBorder: 'border-orange-300',
    description: 'Tenure expires without renewal; flags regulatory alert for renewal enforcement or encashment.',
  },
  {
    step: '07',
    name: 'Renewed / Release Requested',
    icon: RefreshCw,
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
    description: 'Institution uploads extension renewal receipt or files for regulatory refund release.',
  },
  {
    step: '08',
    name: 'Released & Discharged',
    icon: Lock,
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    badgeBorder: 'border-slate-800',
    description: 'Approving authority issues final digital discharge order and lien is revoked with the bank.',
  },
];

export const LifecycleModal: React.FC<LifecycleModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Statutory Lifecycle at a Glance"
      subtitle="The 8 Sequential Stages from Submission to Release"
      maxWidth="2xl"
    >
      <div className="space-y-3">
        {STAGES.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.step}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
            >
              <div className="text-xs font-mono font-bold text-slate-400 mt-1">
                {st.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold text-slate-900">{st.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.badgeBg} ${st.badgeText} ${st.badgeBorder}`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    <span>{st.name}</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{st.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </BaseModal>
  );
};
