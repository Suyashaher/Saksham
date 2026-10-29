import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, LogIn, LayoutDashboard, Layers, Users2, Workflow, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SYSTEM_CONSTANTS } from '../data/homeConstants';
import { useAuth } from '../../auth/AuthContext';

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handlePrimaryClick = () => {
    if (isAuthenticated) {
      switch (user?.role) {
        case 'INSTITUTION':
          navigate('/overview');
          break;
        case 'VERIFYING_OFFICER':
          navigate('/officer/queue');
          break;
        case 'APPROVING_AUTHORITY':
          navigate('/approvals');
          break;
        case 'ADMIN':
          navigate('/admin/impact-metrics');
          break;
        default:
          navigate('/instruments');
      }
    } else {
      navigate('/login');
    }
  };

  const handleLearnMore = () => {
    const el = document.querySelector('#about');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      (el as HTMLElement).focus?.();
    }
  };

  return (
    <section
      id="hero"
      aria-label="Portal Introduction"
      className="relative overflow-hidden bg-gradient-to-b from-primary-50/60 via-white to-slate-50 border-b border-slate-200 pt-10 pb-16 lg:pt-16 lg:pb-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Heading & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Hackathon PS Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100/70 border border-primary-200 text-primary-900 text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>{t('home.hero.badge', 'Smart India Hackathon 2026 • PS 26265 Prototype')}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              {t(
                'home.hero.headline',
                'End-to-End Digital Governance for AICTE Security Deposits & Bank Guarantees'
              )}
            </h1>

            {/* One-Sentence Purpose */}
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-normal max-w-2xl">
              {t(
                'home.hero.purpose',
                "Track every institution's security deposit and FDR from submission to release in one secure place."
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="black"
                size="lg"
                onClick={handlePrimaryClick}
                leftIcon={
                  isAuthenticated ? (
                    <LayoutDashboard className="w-4 h-4 text-accent-light" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )
                }
                rightIcon={<ArrowRight className="w-4 h-4 text-slate-400" />}
                className="font-bold shadow-md hover:shadow-lg transition-all"
              >
                {isAuthenticated
                  ? t('home.hero.cta_dashboard', 'Go to My Dashboard')
                  : t('home.hero.cta_signin', 'Sign In to Portal')}
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={handleLearnMore}
                leftIcon={<BookOpen className="w-4 h-4" />}
                className="font-semibold"
              >
                {t('home.hero.cta_explore', 'Learn How It Works')}
              </Button>
            </div>

            {/* Computed System Facts Bar (Strictly computed constants, zero fake statistics) */}
            <div className="pt-6 border-t border-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                Architectural Parameters & Scope
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-xl">
                    <Layers className="w-4 h-4 text-accent" />
                    <span>{SYSTEM_CONSTANTS.MODULES_COUNT}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">Core Modules</p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-xl">
                    <Users2 className="w-4 h-4 text-teal-600" />
                    <span>{SYSTEM_CONSTANTS.ROLES_COUNT}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">User Roles</p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-xl">
                    <Workflow className="w-4 h-4 text-indigo-600" />
                    <span>{SYSTEM_CONSTANTS.LIFECYCLE_STAGES_COUNT}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">Lifecycle Stages</p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 text-primary font-bold text-xl">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{SYSTEM_CONSTANTS.AUDIT_COVERAGE_PERCENT}%</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">Audit Logging</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Inline SVG Institutional Illustration */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-xl">
              {/* Inner Decorative Watermark Emblem */}
              <div className="absolute top-4 right-4 text-slate-100 -z-0">
                <ShieldCheck className="w-28 h-28 opacity-40 text-primary-100" />
              </div>

              {/* Technical Instrument Simulation Card */}
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-800 tracking-wider uppercase">
                      AICTE Verified Deposit
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-slate-500">
                    FD-2026-DL-8821
                  </span>
                </div>

                {/* SVG Visual Architecture Diagram */}
                <svg
                  className="w-full h-44 rounded-lg bg-slate-50 border border-slate-200 p-2"
                  viewBox="0 0 360 160"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Illustration depicting tripartite security deposit verification between technical institution, bank, and AICTE"
                >
                  {/* Institution Node */}
                  <rect x="20" y="30" width="85" height="48" rx="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                  <circle cx="36" cy="48" r="7" fill="#1B365D" />
                  <rect x="50" y="44" width="45" height="4" rx="2" fill="#334155" />
                  <rect x="50" y="52" width="30" height="3" rx="1.5" fill="#94A3B8" />
                  <text x="62" y="70" fontSize="8" fill="#475569" fontWeight="bold" textAnchor="middle">Institution</text>

                  {/* Arrow 1: Institution to Scrutiny */}
                  <path d="M105 54 L135 54" stroke="#C28212" strokeWidth="2" strokeDasharray="3 3" />
                  <polygon points="135,51 141,54 135,57" fill="#C28212" />

                  {/* AICTE Portal Central Vault Node */}
                  <rect x="142" y="18" width="95" height="72" rx="8" fill="#1B365D" stroke="#102A43" strokeWidth="1.5" />
                  <path d="M189 32 L199 44 H179 Z" fill="#F7C948" />
                  <rect x="160" y="50" width="60" height="5" rx="2" fill="#FFFFFF" />
                  <rect x="166" y="60" width="48" height="4" rx="2" fill="#93C5FD" />
                  <text x="189" y="80" fontSize="9" fill="#FFFFFF" fontWeight="bold" textAnchor="middle">Saksham Portal</text>

                  {/* Arrow 2: Bank to AICTE */}
                  <path d="M275 54 L245 54" stroke="#0D9488" strokeWidth="2" />
                  <polygon points="245,51 239,54 245,57" fill="#0D9488" />

                  {/* Issuing Bank Node */}
                  <rect x="275" y="30" width="70" height="48" rx="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
                  <rect x="285" y="44" width="50" height="4" rx="2" fill="#0D9488" />
                  <rect x="285" y="52" width="35" height="3" rx="1.5" fill="#94A3B8" />
                  <text x="310" y="70" fontSize="8" fill="#475569" fontWeight="bold" textAnchor="middle">Bank Branch</text>

                  {/* Bottom Verification Shield Connection */}
                  <path d="M189 90 L189 115" stroke="#1B365D" strokeWidth="1.5" />
                  <rect x="110" y="115" width="160" height="32" rx="6" fill="#F0FDF4" stroke="#86EFAC" strokeWidth="1" />
                  <text x="190" y="134" fontSize="9" fill="#166534" fontWeight="bold" textAnchor="middle">✓ Tripartite Encumbrance Confirmed</text>
                </svg>

                {/* Simulated Instrument Attribute Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">Security Type</span>
                    <span className="font-bold text-slate-800">Joint FDR (8-Year)</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">Lien Holder</span>
                    <span className="font-bold text-slate-800">Member Secretary, AICTE</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Status: Active & Valid
                  </span>
                  <span className="font-semibold text-primary">Zero Paper Friction</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
