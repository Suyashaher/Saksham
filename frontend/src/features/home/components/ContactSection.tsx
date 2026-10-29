import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Clock, MapPin, ExternalLink, LifeBuoy } from 'lucide-react';
import { CONTACT_CONFIG } from '../data/contactConfig';

export const ContactSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="contact"
      aria-label="Contact and Technical Helpdesk"
      className="py-16 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-100/70 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.contact.section_badge', 'Official Support')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.contact.section_title', 'Contact & Technical Helpdesk')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.contact.section_subtitle',
              'Reach the AICTE Regulation Bureau or technical support team.'
            )}
          </p>
        </div>

        {/* Contact Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Technical Helpdesk */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="p-3 w-fit rounded-xl bg-primary-50 text-primary mb-4 border border-primary-100">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Technical Support Desk</h3>
              <p className="text-xs text-slate-500 mb-4">
                Assistance with portal logins, OTP verification, or certificate uploads.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <a
                    href={`mailto:${CONTACT_CONFIG.helpdeskEmail}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {CONTACT_CONFIG.helpdeskEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary shrink-0" />
                  <span>{CONTACT_CONFIG.helplinePhone}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
              Config: helpdeskEmail
            </div>
          </div>

          {/* Card 2: Operating Hours & Head Office */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="p-3 w-fit rounded-xl bg-teal-50 text-teal-800 mb-4 border border-teal-100">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Hours of Operation</h3>
              <p className="text-xs text-slate-500 mb-4">
                Working days and scheduled regulatory support timings.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="leading-relaxed">{CONTACT_CONFIG.supportHours}</p>
                <div className="flex items-start gap-2 pt-1 text-slate-600">
                  <MapPin className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>{CONTACT_CONFIG.headquartersAddress}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
              HQ: Vasant Kunj, New Delhi
            </div>
          </div>

          {/* Card 3: Grievance Escalation & Accessibility Statement */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="p-3 w-fit rounded-xl bg-amber-50 text-amber-900 mb-4 border border-amber-200">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Grievances & Accessibility</h3>
              <p className="text-xs text-slate-500 mb-4">
                Escalations regarding deposit release delays or accessibility barriers.
              </p>

              <div className="space-y-3 text-xs text-slate-700">
                <p>
                  Emergency Escalation:{' '}
                  <span className="font-semibold text-slate-900">
                    {CONTACT_CONFIG.emergencyEscalation}
                  </span>
                </p>
                <a
                  href="#accessibility-statement"
                  className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline text-xs"
                >
                  <span>Review Accessibility Statement</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
              Bureau: Regulation Bureau
            </div>
          </div>
        </div>

        {/* Configuration Notice */}
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-center text-xs text-slate-600">
          <p>
            Helpdesk contact parameters are loaded dynamically from <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">contactConfig.ts</code>. In production, phone numbers link directly to the AICTE Centralized Support System (CSS).
          </p>
        </div>
      </div>
    </section>
  );
};
