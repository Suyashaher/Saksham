import React from 'react';
import { BaseModal } from './BaseModal';
import { CORE_MODULES } from '../../data/modulesData';
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
  Search,
  Sparkles,
} from 'lucide-react';

interface ModulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export const ModulesModal: React.FC<ModulesModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Core System Modules & Intelligent Tools"
      subtitle="Complete Architectural Breakdown of the Saksham Management System"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Featured AI Intelligence Suite Banner (Modules 4 & 5 + NL Search) */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-900/10 via-primary-50 to-blue-50 border border-blue-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">
                    Saksham AI Intelligence Suite (Modules 4 & 5)
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-900 font-bold text-[9px] border border-cyan-300">
                    Active Copilot
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Conversational assistant available 24/7 across the portal with dedicated compliance checking and mathematical model explainability.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 shrink-0">
              Floating Copilot Widget
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-200/60">
            <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
              <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                4. Institutional Compliance Intelligence
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Evaluates institutional deposit portfolios, shortfall warnings, mandatory tripartite FDR norms, and release eligibility.
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
              <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                5. Explainable AI Assistance
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Deconstructs 10-factor Trust Scores, unpacks turnaround confidence intervals, and explains OCR discrepancy root causes.
              </p>
            </div>
          </div>
        </div>

        {/* 10 Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {CORE_MODULES.map((module) => {
            const Icon = iconMap[module.iconName] || Database;
            return (
              <div
                key={module.id}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-white border border-slate-200 text-primary shrink-0 shadow-2xs">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-xs font-bold text-slate-900">{module.title}</h3>
                    <span className="text-[10px] font-mono text-slate-400">#{module.number}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{module.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseModal>
  );
};

