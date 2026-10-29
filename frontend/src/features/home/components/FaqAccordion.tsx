import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQS_DATA } from '../data/faqsData';

export const FaqAccordion: React.FC = () => {
  const { t } = useTranslation();
  // Store expanded item IDs
  const [openId, setOpenId] = useState<string | null>(FAQS_DATA[0]?.id || null);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faqs"
      aria-label="Frequently Asked Questions"
      className="py-16 bg-white border-b border-slate-200"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.faqs.section_badge', 'Questions & Answers')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.faqs.section_title', 'Frequently Asked Questions')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.faqs.section_subtitle',
              'Answers based on the actual architectural implementation and statutory operating rules.'
            )}
          </p>
        </div>

        {/* Accessible Accordion (button + aria-expanded + role="region") */}
        <div className="space-y-3">
          {FAQS_DATA.map((faq, index) => {
            const isOpen = openId === faq.id;
            const buttonId = `faq-btn-${faq.id}`;
            const panelId = `faq-panel-${faq.id}`;

            return (
              <div
                key={faq.id}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'border-primary-300 bg-primary-50/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleItem(faq.id)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-primary rounded-xl cursor-pointer"
                  >
                    <span className="flex items-center gap-3 text-sm sm:text-base font-bold text-slate-900">
                      <span className="text-xs font-mono font-bold text-primary bg-primary-100/80 px-2 py-0.5 rounded">
                        Q{index + 1}
                      </span>
                      <span>{faq.question}</span>
                    </span>

                    <ChevronDown
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-primary' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className={`px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-700 leading-relaxed border-t ${
                    isOpen ? 'border-primary-100 block' : 'hidden'
                  }`}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prototype Transparency Footnote */}
        <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-slate-400 shrink-0" />
          <p>
            Have additional questions regarding SIH Problem Statement 26265? All system operational rules and model cards are documented in detail in the project documentation directory.
          </p>
        </div>
      </div>
    </section>
  );
};
