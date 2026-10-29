import React, { useState } from 'react';
import { Bell, ChevronRight, Tag } from 'lucide-react';
import { SAMPLE_NOTICES, PublicNotice } from '../data/noticesData';

interface NoticeTickerLineProps {
  onOpenNoticeDetail?: (notice: PublicNotice) => void;
}

export const NoticeTickerLine: React.FC<NoticeTickerLineProps> = ({ onOpenNoticeDetail }) => {
  const [activeNoticeIdx] = useState(0);
  const activeNotice = SAMPLE_NOTICES[activeNoticeIdx] || SAMPLE_NOTICES[0];

  return (
    <div
      role="region"
      aria-label="Latest Notices Ticker"
      className="bg-amber-50/70 border-b border-amber-200/80 px-4 sm:px-6 lg:px-8 py-1.5 text-xs text-slate-800 shrink-0"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 uppercase tracking-wider shrink-0 bg-amber-200/70 px-1.5 py-0.5 rounded">
            <Bell className="w-3 h-3 text-amber-800" />
            <span className="hidden sm:inline">Notice:</span>
          </div>

          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent-dark bg-white border border-amber-300 px-1.5 py-0.5 rounded shrink-0">
            <Tag className="w-2.5 h-2.5" />
            Sample notice
          </span>

          <span className="font-semibold text-slate-900 truncate text-[11px] sm:text-xs">
            {activeNotice.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 hidden md:inline font-medium">
            {activeNotice.date}
          </span>
          {onOpenNoticeDetail && (
            <button
              type="button"
              onClick={() => onOpenNoticeDetail(activeNotice)}
              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary hover:underline"
            >
              <span>View</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
