import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, LogIn, Building2, ShieldCheck, CheckSquare } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../auth/AuthContext';

type ActiveRoleTab = 'INSTITUTION' | 'OFFICER' | 'APPROVER';

interface RoleSteps {
  roleName: string;
  tabLabel: string;
  icon: React.ElementType;
  steps: {
    num: string;
    title: string;
    description: string;
  }[];
}

const ONBOARDING_GUIDES: Record<ActiveRoleTab, RoleSteps> = {
  INSTITUTION: {
    roleName: 'Technical Institutions',
    tabLabel: 'Institutions',
    icon: Building2,
    steps: [
      {
        num: '1',
        title: 'Sign In to Portal',
        description: 'Log in using your registered AICTE Permanent ID (PID) and complete two-factor OTP verification.',
      },
      {
        num: '2',
        title: 'Enter Deposit Particulars',
        description: 'Fill in the FDR or Bank Guarantee number, amount, tenure, issuing bank, and branch IFSC.',
      },
      {
        num: '3',
        title: 'Upload Official Certificates',
        description: 'Attach scanned copies of the joint fixed deposit receipt and signed bank confirmation lien letter.',
      },
      {
        num: '4',
        title: 'Track Scrutiny & Renewal',
        description: 'Monitor your dashboard for officer scrutiny updates, bank verification tags, and 90-day maturity alerts.',
      },
    ],
  },
  OFFICER: {
    roleName: 'Verifying Scrutiny Officers',
    tabLabel: 'Scrutiny Officers',
    icon: ShieldCheck,
    steps: [
      {
        num: '1',
        title: 'Access Scrutiny Queue',
        description: 'Sign in with your official AICTE credentials to access newly submitted instruments prioritized by Trust Score.',
      },
      {
        num: '2',
        title: 'Review Side-by-Side OCR',
        description: 'Use the Document Scrutiny Viewer to compare self-declared institutional entries against scanned certificates.',
      },
      {
        num: '3',
        title: 'Validate Bank Lien & Authenticity',
        description: 'Confirm that the bank confirmation letter is authentic and the lien is irrevocable in favor of AICTE.',
      },
      {
        num: '4',
        title: 'Verify & Forward to Approver',
        description: 'Mark the instrument Bank-Verified, record scrutiny notes, and forward the complete dossier to the Approving Authority.',
      },
    ],
  },
  APPROVER: {
    roleName: 'Approving Authorities',
    tabLabel: 'Approving Authorities',
    icon: CheckSquare,
    steps: [
      {
        num: '1',
        title: 'Open Approvals Inbox',
        description: 'Review verified instruments submitted by regional scrutiny officers across the country.',
      },
      {
        num: '2',
        title: 'Inspect Compliance & Audit Records',
        description: 'Review the cryptographic audit trail, bank confirmation tags, and officer scrutiny remarks.',
      },
      {
        num: '3',
        title: 'Grant Statutory Sanction',
        description: 'Approve the security deposit encumbrance, formal renewal, or final discharge with digital authentication.',
      },
      {
        num: '4',
        title: 'Track Maturity Countdown',
        description: 'Utilize the Deposit Registry & Maturity Tracker to monitor overdue liabilities and institutional compliance.',
      },
    ],
  },
};

export const GettingStartedSection: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveRoleTab>('INSTITUTION');

  const currentGuide = ONBOARDING_GUIDES[activeTab];
  const TabIcon = currentGuide.icon;

  return (
    <section
      id="getting-started"
      aria-label="How to Get Started"
      className="py-16 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-100/70 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.getting_started.section_badge', 'Onboarding')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.getting_started.section_title', 'How to Get Started')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.getting_started.section_subtitle',
              'Simple role-specific workflows to begin utilizing the Saksham portal.'
            )}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300">
            {(Object.keys(ONBOARDING_GUIDES) as ActiveRoleTab[]).map((tabKey) => {
              const guide = ONBOARDING_GUIDES[tabKey];
              const Icon = guide.icon;
              return (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setActiveTab(tabKey)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tabKey
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span>{guide.tabLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Steps Grid for Active Role */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <div className="flex items-center gap-3 pb-6 mb-6 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-primary-50 text-primary border border-primary-100">
              <TabIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{currentGuide.roleName} Walkthrough</h3>
              <p className="text-xs text-slate-500">Four straightforward steps to complete your tasks</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {currentGuide.steps.map((step) => (
              <div key={step.num} className="flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-black mb-3 shadow-xs">
                    {step.num}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign In Callout */}
        <div className="text-center">
          <Button
            variant="black"
            size="lg"
            onClick={() => navigate(isAuthenticated ? '/overview' : '/login')}
            leftIcon={<LogIn className="w-4 h-4" />}
            rightIcon={<ArrowRight className="w-4 h-4 text-slate-400" />}
            className="font-bold shadow-md hover:shadow-lg transition-all"
          >
            {isAuthenticated ? 'Proceed to My Role Workspace' : 'Sign In with Registered Credentials'}
          </Button>
        </div>
      </div>
    </section>
  );
};
