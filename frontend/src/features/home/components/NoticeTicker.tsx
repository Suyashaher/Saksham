import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronRight, FileText, Calendar, Tag } from 'lucide-react';
import { SAMPLE_NOTICES, PublicNotice } from '../data/noticesData';

export const NoticeTicker: React.FC = () => {
  const { t } = useTranslation();
  const [selectedNotice, setSelectedNotice] = useState<PublicNotice | null>(null);

  return (
    <section
      id="notices"
      aria-label="Notices and Circulars Strip"
      className="bg-white border-b border-slate-200 py-6"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-accent-50 text-accent-dark border border-accent-200">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {t('home.notices.section_title', 'Notices & Regulatory Circulars')}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700 border border-slate-200">
              <Tag className="w-3 h-3 text-slate-500" />
              {t('home.notices.sample_notice_badge', 'Sample notice')}
            </span>
            <span>(Demonstration Data)</span>
          </div>
        </div>

        {/* 4 Notices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SAMPLE_NOTICES.slice(0, 4).map((notice) => (
            <div
              key={notice.id}
              className="flex flex-col justify-between p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-primary-300 hover:bg-primary-50/20 transition-all duration-150 group shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2 py-0.5 rounded bg-primary-100/70">
                    <Calendar className="w-3 h-3" />
                    <span>{notice.date}</span>
                  </span>

                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark bg-accent-50 border border-accent-200 px-1.5 py-0.5 rounded">
                    Sample Notice
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {notice.title}
                </h3>

                <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                  {notice.summary}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-primary">
                <span className="text-[11px] text-slate-500 font-medium">Ref: {notice.category}</span>
                <button
                  type="button"
                  onClick={() => setSelectedNotice(notice)}
                  className="inline-flex items-center gap-1 hover:underline text-xs"
                >
                  <span>Details</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accessible Notice Detail Modal */}
      {selectedNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notice-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Official Circular View
                </span>
              </div>
              <span className="text-xs font-bold text-accent-dark bg-accent-50 border border-accent-200 px-2 py-0.5 rounded">
                Sample Notice
              </span>
            </div>

            <h3 id="notice-modal-title" className="text-lg font-bold text-slate-900">
              {selectedNotice.title}
            </h3>

            <div className="flex items-center gap-3 text-xs text-slate-500 pb-2 border-b border-slate-100">
              <span>Date: <strong>{selectedNotice.date}</strong></span>
              <span>•</span>
              <span>Classification: <strong>{selectedNotice.category}</strong></span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {selectedNotice.summary}
            </p>

            <div className="p-3 bg-slate-50 rounded text-xs text-slate-600 border border-slate-200">
              <p className="font-semibold text-slate-800">Regulatory Advisory Note:</p>
              <p className="mt-0.5">
                This notice is a demonstration sample configured in the editable repository. In production, official circulars are synchronized directly with the AICTE Gazette publishing system.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-4 py-2 bg-slate-950 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
