import React from 'react';
import { Database, ShieldCheck, BellRing, History, FileCheck2 } from 'lucide-react';

export const HighlightsRibbon: React.FC = () => {
  const highlights = [
    {
      icon: Database,
      title: 'Central Repository',
      desc: 'National FDR & BG registry',
    },
    {
      icon: ShieldCheck,
      title: 'Bank Verification',
      desc: 'Independent branch lien checks',
    },
    {
      icon: BellRing,
      title: 'Auto Reminders',
      desc: '90, 60 & 30-day alert cycles',
    },
    {
      icon: History,
      title: 'Tamper-Evident Audit',
      desc: 'SHA-256 hash-chained event logs',
    },
    {
      icon: FileCheck2,
      title: 'Release & Refund Workflow',
      desc: 'Statutory conditional discharge',
    },
  ];

  return (
    <div
      role="region"
      aria-label="System Capabilities Highlights"
      className="bg-[#0b192c]/90 border-t border-white/10 px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5 shrink-0 z-20 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        {highlights.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="flex items-center gap-2 text-left">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-400/20 shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="block text-[11px] sm:text-xs font-bold text-white leading-tight">
                  {item.title}
                </span>
                <span className="block text-[9px] sm:text-[10px] text-slate-400 leading-tight">
                  {item.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
