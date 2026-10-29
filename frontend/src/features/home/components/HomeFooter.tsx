import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Accessibility, ArrowUp, Calendar, CheckCircle } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { SYSTEM_CONSTANTS } from '../data/homeConstants';

export const HomeFooter: React.FC = () => {
  const { t } = useTranslation();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { label: t('home.nav.home', 'Home'), href: '#hero' },
    { label: t('home.nav.about', 'About the Portal'), href: '#about' },
    { label: t('home.nav.lifecycle', 'Lifecycle at a Glance'), href: '#lifecycle' },
    { label: t('home.nav.modules', 'Core Modules'), href: '#modules' },
    { label: t('home.nav.roles', 'User Roles'), href: '#roles' },
    { label: t('home.nav.smart_ai', 'Smart Assistance'), href: '#smart-assistance' },
    { label: t('home.nav.security', 'Security & Trust'), href: '#security' },
    { label: t('home.nav.faqs', 'FAQs'), href: '#faqs' },
    { label: t('home.nav.contact', 'Contact & Help'), href: '#contact' },
  ];

  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Disclaimer Banner (Honesty Principle) */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-accent-light shrink-0" />
            <div className="text-xs sm:text-sm text-slate-300">
              <span className="font-bold text-white">Prototype Notice: </span>
              <span>
                {t(
                  'home.footer.disclaimer_text',
                  'Prototype developed for Smart India Hackathon (PS 26265). Not an official AICTE website.'
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors shrink-0"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Multi-Column Sitemap & Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4">
          {/* Brand & Statutory Attribution Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 w-fit">
              <BrandMark size="sm" showSubtitle={false} className="text-white" />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {SYSTEM_CONSTANTS.SYSTEM_FULL_NAME} (Saksham). Designed for the Regulation Bureau, All India Council for Technical Education, to provide a single digital source of truth for statutory deposits.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Last Updated: <strong>{SYSTEM_CONSTANTS.BUILD_DATE}</strong></span>
              <span>•</span>
              <span className="font-mono">{SYSTEM_CONSTANTS.BUILD_VERSION}</span>
            </div>
          </div>

          {/* Quick Anchor Links Column */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Navigation Anchors
            </h3>
            <ul className="space-y-1.5 text-xs">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-400 hover:text-white hover:underline transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Accessibility Statement Column */}
          <div id="accessibility-statement" className="md:col-span-4 space-y-3">
            <div className="flex items-center gap-2 text-white">
              <Accessibility className="w-4 h-4 text-accent-light" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {t('home.footer.accessibility_title', 'Accessibility Statement')}
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {t(
                'home.footer.accessibility_desc',
                'This portal conforms to WCAG 2.1 Level AA guidelines, featuring semantic landmarks, keyboard operability, responsive text-scaling, and high-contrast support.'
              )}
            </p>

            <ul className="space-y-1 text-xs text-slate-400">
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>Text size resizer (A-, A, A+)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>High-contrast visual toggle</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>Screen-reader skip landmarks</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>Strict WCAG 2.1 AA color contrast</span>
              </li>
            </ul>

            <p className="text-[11px] text-slate-500 pt-1">
              To report an accessibility issue, contact: <a href="mailto:support-saksham@aicte-india.org" className="underline hover:text-white">support-saksham@aicte-india.org</a>
            </p>
          </div>
        </div>

        {/* Bottom Copyright & Legal Line */}
        <div className="pt-8 border-t border-slate-900 text-center text-xs text-slate-500 space-y-1">
          <p>
            {t(
              'home.footer.copyright',
              'Prototype for Smart India Hackathon 2026 • AICTE Security Deposit Management Portal'
            )}
          </p>
          <p className="text-[11px] text-slate-600">
            Smart India Hackathon • Problem Statement PS 26265 • Designed for Academic Evaluation
          </p>
        </div>
      </div>
    </footer>
  );
};
