import React from 'react';
import { useTranslation } from 'react-i18next';
import { VerificationTag } from '../../../components/ui/VerificationTag';
import { ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react';

export const VerificationExplainer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="verification"
      aria-label="Self-Declared vs Bank-Verified Principle"
      className="py-16 bg-slate-100/60 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-accent-dark bg-accent-50 px-3 py-1 rounded-full border border-accent-200 mb-3">
            {t('home.verification.section_badge', 'Core Principle')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.verification.section_title', 'Self-Declared vs. Bank-Verified')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.verification.section_subtitle',
              'What an institution submits remains strictly separated from what an issuing bank confirms.'
            )}
          </p>
        </div>

        {/* Dual Demonstration Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Side 1: Self-Declared */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tier 1 • Initial Entry
                  </span>
                </div>
                {/* Live Real VerificationTag Component */}
                <VerificationTag isBankVerified={false} />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t('home.verification.self_declared_heading', 'Self-Declared Information')}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {t(
                  'home.verification.self_declared_body',
                  'When an institution submits a new FDR or Bank Guarantee, all details (FDR number, amount, maturity date, bank branch) are treated as Self-Declared. These entries are subject to scrutiny and cannot be treated as valid legal security until independently corroborated.'
                )}
              </p>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <p className="font-semibold text-slate-900">Institutional Submission Scope:</p>
                <p>• Scanned copy of fixed deposit receipt uploaded by registrar.</p>
                <p>• Declared principal, maturity tenure, and joint beneficiary name.</p>
                <p className="text-amber-800 font-medium">⚠️ Pending formal confirmation by branch manager.</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>Risk State: Scrutiny Required</span>
              <span className="font-mono text-[11px]">Flag: UNCONFIRMED</span>
            </div>
          </div>

          {/* Side 2: Bank-Verified */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-teal-600/30 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-teal-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-700" />
                  <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                    Tier 2 • Regulatory Certainty
                  </span>
                </div>
                {/* Live Real VerificationTag Component */}
                <VerificationTag
                  isBankVerified={true}
                  sourceText="SBI Branch letter ref SBI/VK/2026/410"
                  verifiedAt="14 Oct 2026"
                />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {t('home.verification.bank_verified_heading', 'Bank-Verified Status')}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {t(
                  'home.verification.bank_verified_body',
                  'Only after the issuing bank branch confirms the instrument—via official confirmation letter, digital lien marking, or bank API integration—is the instrument designated as Bank-Verified. This dual-state architecture prevents unauthorized or unencumbered submissions.'
                )}
              </p>

              <div className="bg-teal-50/70 p-3.5 rounded-lg border border-teal-200 text-xs text-teal-950 space-y-1.5">
                <p className="font-semibold text-teal-900">Branch Confirmation Attributes:</p>
                <p>• Irrevocable lien marked in favor of Member Secretary, AICTE.</p>
                <p>• Verified FDR number, principal lock, and maturity match branch records.</p>
                <p className="text-teal-800 font-semibold">✓ Confirmed unencumbered and non-pledged.</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-teal-100 text-xs text-teal-800 flex items-center justify-between">
              <span className="font-semibold">Statutory State: Enforceable Legal Lien</span>
              <span className="font-mono text-[11px] font-bold">STATUS: CONFIRMED</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
