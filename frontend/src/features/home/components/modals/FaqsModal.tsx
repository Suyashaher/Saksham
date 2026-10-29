import React, { useState } from 'react';
import { BaseModal } from './BaseModal';
import { FAQS_DATA } from '../../data/faqsData';
import { ChevronDown } from 'lucide-react';

interface FaqsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FaqsModal: React.FC<FaqsModalProps> = ({ isOpen, onClose }) => {
  const [openId, setOpenId] = useState<string | null>(FAQS_DATA[0]?.id || null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Frequently Asked Questions"
      subtitle="Operational & Technical Answers based on the Saksham System Implementation"
      maxWidth="2xl"
    >
      <div className="space-y-2.5">
        {FAQS_DATA.map((faq, i) => {
          const isExpanded = openId === faq.id;
          return (
            <div
              key={faq.id}
              className={`rounded-xl border transition-colors overflow-hidden ${
                isExpanded ? 'border-primary-300 bg-primary-50/20' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggle(faq.id)}
                  className="w-full text-left p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-primary bg-primary-100 px-1.5 py-0.5 rounded">
                      Q{i + 1}
                    </span>
                    <span>{faq.question}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                      isExpanded ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>
              </h3>

              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-0 text-xs text-slate-700 leading-relaxed border-t border-primary-100/60">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BaseModal>
  );
};
