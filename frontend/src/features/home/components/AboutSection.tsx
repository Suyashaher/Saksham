import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Shield, FileSpreadsheet, Clock, ArrowRight } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="about"
      aria-label="About the Saksham Portal"
      className="py-16 bg-white border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.about.section_badge', 'Statutory Context')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.about.section_title', 'About the Saksham Portal')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.about.section_subtitle',
              'Transitioning from fragmented physical paperwork to a unified national digital repository.'
            )}
          </p>
        </div>

        {/* Contrast Cards: The Problem vs The Solution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: The Problem */}
          <div className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-amber-50/40 border border-amber-200 shadow-xs">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t('home.about.challenge_title', 'The Legacy Challenge')}
                </h3>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                {t(
                  'home.about.challenge_desc',
                  'Managing thousands of Fixed Deposit Receipts (FDRs) and Bank Guarantees across hundreds of technical institutions has historically relied on physical paper receipts, manual branch follow-ups, and fragmented registers. This created operational risks of missed maturity dates, delayed renewals, and administrative friction during rightful release.'
                )}
              </p>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Manual Follow-Up:</strong> Tracking maturity dates across 500+ commercial banks via physical mail leads to inadvertent lapses.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Fragmented Records:</strong> Paper certificates stored across regional offices risk physical loss or degradation over 8-year tenures.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Delayed Releases:</strong> Legitimate refund and release requests take months to verify without centralized audit logs.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-amber-200 text-xs font-semibold text-amber-900">
              Past Vulnerability: Lack of continuous statutory visibility
            </div>
          </div>

          {/* Card 2: The Solution */}
          <div className="flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-primary-100 text-primary-900 border border-primary-200">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t('home.about.solution_title', 'The Saksham Digital Solution')}
                </h3>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                {t(
                  'home.about.solution_desc',
                  'Saksham establishes a unified single source of truth connecting technical institutions, scrutiny officers, issuing bank branches, and approving authorities. By combining automated maturity tracking, independent bank-verified tagging, and an immutable audit trail, the portal ensures complete transparency and regulatory compliance across every instrument’s lifecycle.'
                )}
              </p>

              <ul className="space-y-3 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Single Source of Truth:</strong> Central digital ledger indexing every security deposit with immutable SHA-256 event chaining.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Automated Safeguards:</strong> 90, 60, and 30-day proactive alert cycles ensure timely renewal and zero encashment disputes.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Bank-Verified Trust:</strong> Clear separation between institutional self-declaration and verified branch lien marking.
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-200 text-xs font-semibold text-emerald-700 flex items-center justify-between">
              <span>Modern Standard: Complete statutory transparency</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
