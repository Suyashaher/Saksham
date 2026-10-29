import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Database,
  FolderArchive,
  FileCheck,
  Clock,
  RefreshCw,
  ShieldCheck,
  BellRing,
  BarChart3,
  History,
  Lock,
} from 'lucide-react';
import { CORE_MODULES } from '../data/modulesData';

const iconMap: Record<string, React.ElementType> = {
  Database,
  FolderArchive,
  FileCheck,
  ClockAlert: Clock,
  RefreshCw,
  ShieldCheck,
  BellRing,
  BarChart3,
  History,
  Lock,
};

export const KeyModulesGrid: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section
      id="modules"
      aria-label="Key Modules of Saksham Portal"
      className="py-16 bg-white border-b border-slate-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary-50 px-3 py-1 rounded-full border border-primary-200 mb-3">
            {t('home.modules.section_badge', 'Architecture')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('home.modules.section_title', 'Ten Core Modules')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            {t(
              'home.modules.section_subtitle',
              'Purpose-built functional components delivering end-to-end security deposit oversight.'
            )}
          </p>
        </div>

        {/* 10 Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {CORE_MODULES.map((module) => {
            const IconComponent = iconMap[module.iconName] || Database;
            return (
              <div
                key={module.id}
                className="flex flex-col justify-between p-5 rounded-xl bg-slate-50 border border-slate-200 hover:border-primary-400 hover:bg-primary-50/20 transition-all duration-200 shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-primary group-hover:text-primary-dark group-hover:border-primary-300 shadow-xs transition-colors">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{module.number}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors leading-snug mb-2">
                    {module.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {module.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Module Ready
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
