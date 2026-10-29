import React from 'react';
import { useTranslation } from 'react-i18next';
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

interface LifecycleStage {
  step: string;
  name: string;
  badgeCode: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    step: '01',
    name: 'Submitted',
    badgeCode: 'SUBMITTED',
    icon: FileText,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    description: 'Institution enters deposit particulars and uploads scanned certificate.',
  },
  {
    step: '02',
    name: 'Under Scrutiny',
    badgeCode: 'UNDER_SCRUTINY',
    icon: Clock,
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300',
    description: 'AICTE scrutiny officer evaluates completeness and OCR extraction.',
  },
  {
    step: '03',
    name: 'Verified (or Discrepancy)',
    badgeCode: 'VERIFIED',
    icon: ShieldCheck,
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-800',
    badgeBorder: 'border-teal-300',
    description: 'Issuing bank branch confirms lien; any mismatch triggers discrepancy notice.',
  },
  {
    step: '04',
    name: 'Active & Valid',
    badgeCode: 'ACTIVE',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    description: 'Approved security deposit remains safely locked in favor of AICTE.',
  },
  {
    step: '05',
    name: 'Expiring Soon',
    badgeCode: 'EXPIRING',
    icon: AlertCircle,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    description: 'Automated advance reminders sent at 90, 60, and 30-day thresholds.',
  },
  {
    step: '06',
    name: 'Matured / Overdue',
    badgeCode: 'MATURED',
    icon: AlertOctagon,
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-900',
    badgeBorder: 'border-orange-300',
    description: 'Statutory validity expires; immediate renewal or encashment review required.',
  },
  {
    step: '07',
    name: 'Renewed / Release Requested',
    badgeCode: 'RENEWED',
    icon: RefreshCw,
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
    description: 'Institution files renewal certificate or submits refund release request.',
  },
  {
    step: '08',
    name: 'Released & Discharged',
    badgeCode: 'RELEASED',
    icon: Lock,
    badgeBg: 'bg-slate-900',
    badgeText: 'text-white',
    badgeBorder: 'border-slate-800',
    description: 'Approving authority issues digital discharge order and lien is revoked.',
  },
];

export const LifecycleStepper: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="lifecycle"
      aria-label="Lifecycle at a Glance"
      className="py-16 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-100/70 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.lifecycle.section_badge', 'Process Flow')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.lifecycle.section_title', 'Lifecycle at a Glance')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.lifecycle.section_subtitle',
              'Every security deposit follows an 8-stage statutory lifecycle from initial upload to formal discharge.'
            )}
          </p>
        </div>

        {/* Stepper Container: Vertical on mobile, responsive grid on desktop */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {LIFECYCLE_STAGES.map((stage) => {
              const IconComp = stage.icon;
              return (
                <div
                  key={stage.step}
                  className="flex flex-col justify-between p-5 rounded-xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow duration-150"
                >
                  <div>
                    {/* Header with Step Number & Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        STAGE {stage.step}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold ${stage.badgeBg} ${stage.badgeText} ${stage.badgeBorder}`}
                      >
                        <IconComp className="w-3 h-3 shrink-0" />
                        <span>{stage.name}</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1.5">
                      {stage.name}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {stage.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Status: {stage.badgeCode}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
